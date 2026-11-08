import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import recorded from "../../../data/pi/recorded.json";
import { MODEL, ModelDeclinedError, usageFrom, type Usage } from "@/lib/shared/llm";
import { SCREEN } from "./detect";
import type { BriefText, Fact, Lead, PiBrief, TraceStep } from "./types";

export class ReplayMissingError extends Error {}

/** What the model writes. It explains the lead; code has already scored and tiered it. */
export const BriefOutput = z.object({
  headline: z.string(),
  pattern: z.string(),
  alternative_explanations: z.array(z.string()),
  next_steps: z.array(z.string()),
  cited_fact_ids: z.array(z.string()),
});

// Kept byte-identical across requests so it can be served from the prompt cache.
const SYSTEM_PROMPT = `You write lead briefs for analysts on a health plan's special investigations unit. A statistical screen has already flagged this provider and set the tier. You explain the billing pattern so an analyst can decide what to do. You do not decide anything.

Rules:
- Use only the facts provided. Copy every number exactly as it appears in a fact. Do not calculate, round or introduce any other number, and do not number your lists.
- This includes illustrations: no example durations, thresholds or dates, and no procedure codes the facts don't mention. Write "99215" rather than "level 5". Describe alternatives in words instead.
- Describe billing patterns, not conduct. A statistical outlier is not evidence of wrongdoing. Never use the words fraud, fraudulent, abuse, abusive, upcoding, kickback, scheme, illegal, criminal, intentional or deliberate, and never state or imply intent.
- "headline": one sentence naming the pattern.
- "pattern": two or three plain sentences for the analyst, on what stands out against peers and why it matters for review.
- "alternative_explanations": at least two legitimate reasons that could explain the pattern, each with what would confirm or rule it out.
- "next_steps": concrete steps for the analyst, using the record sample size in the facts. Never recommend recoupment, payment holds, termination or a referral to law enforcement. Those decisions belong to people after a records review.
- "cited_fact_ids": the ids of the facts you relied on.`;

/** Words that state or imply wrongdoing. A brief containing one is held for an analyst to rewrite. */
const ACCUSATORY = /\b(fraud\w*|abus\w*|upcod\w*|kickback\w*|scheme\w*|illegal\w*|criminal\w*|intentional\w*|deliberate\w*)\b/gi;
const PROVIDER_ID = /PRV-SYN-\d+/g;
const NUMBERS = /\d+(?:,\d{3})*(?:\.\d+)?/g;

const numberOf = (s: string) => Number(s.replace(/,/g, ""));
const numbersIn = (text: string) => text.replace(PROVIDER_ID, " ").match(NUMBERS) ?? [];

/** What the code decides: the action follows the tier, and the model can't change either. */
function actionFor(lead: Lead) {
  return lead.tier === "high"
    ? { sample: 30, action: "Open a records review" }
    : { sample: 15, action: "Analyst review; provider education if the pattern is confirmed" };
}

/** The only facts the model sees. All are aggregates, with no member-level data. */
export function buildFacts(lead: Lead): Fact[] {
  const { sample, action } = actionFor(lead);
  const group = SCREEN.peers[lead.specialty];
  const peerCount = Object.values(group)[0].length;
  const facts: Fact[] = [
    { id: "F-COHORT", text: `Review period ${SCREEN.period}. Peer group: ${peerCount} ${lead.specialty} providers.`, flagged: false },
    { id: "F-VOLUME", text: `Visits in the period: ${lead.encounters.toLocaleString("en-US")}.`, flagged: false },
  ];
  const risk = group.level5_share?.find((p) => p.id === lead.providerId)?.risk;
  if (risk !== undefined) facts.push({ id: "F-RISK", text: `Average patient risk score: ${risk.toFixed(2)}.`, flagged: false });
  for (const f of lead.features) {
    const expected = f.expectedDisplay ? `, expected for this panel's risk ${f.expectedDisplay}` : "";
    const rule = f.hardRule ? ", above the plausibility limit of 16 hours" : "";
    facts.push({
      id: `F-${f.id}`,
      text: `${f.label}: ${f.display} (peer median ${f.peerDisplay}${expected}, robust z-score ${f.z.toFixed(1)}${rule}). ${f.flagged ? "Flagged by the screen." : "Not flagged."}`,
      flagged: f.flagged,
    });
  }
  if (lead.exposure > 0) {
    facts.push({
      id: "F-EXPOSURE",
      text: `Estimated billing above the peer pattern: $${lead.exposure.toLocaleString("en-US")}. This sizes the lead and is not an overpayment finding.`,
      flagged: false,
    });
  }
  facts.push({ id: "F-TIER", text: `Screen tier: ${lead.tier}. Screen score: ${lead.score}. Action: ${action}.`, flagged: false });
  facts.push({ id: "F-SAMPLE", text: `Record sample to request: ${sample} claims.`, flagged: false });
  return facts;
}

async function callModel(lead: Lead, facts: Fact[]) {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium", format: betaZodOutputFormat(BriefOutput) },
    messages: [
      {
        role: "user",
        content: `<lead provider="${lead.providerId}" specialty="${lead.specialty}">\n${facts.map((f) => `${f.id}: ${f.text}`).join("\n")}\n</lead>\n\nWrite the brief.`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new ModelDeclinedError("The model declined this lead. An analyst can review the screen results directly.");
  if (!response.parsed_output) throw new Error(`Brief did not match the schema (stop_reason: ${response.stop_reason}).`);
  return { output: response.parsed_output, model: response.model, usage: usageFrom(response.usage) };
}

/** Code checks on the brief: figures must come from the facts, language stays neutral, citations resolve. */
export function checkBrief(facts: Fact[], brief: BriefText) {
  const text = [brief.headline, brief.pattern, ...brief.alternative_explanations, ...brief.next_steps].join("\n");

  const allowed = new Set(facts.flatMap((f) => numbersIn(f.text)).map(numberOf));
  const found = numbersIn(text);
  const unsupported = [...new Set(found.filter((n) => !allowed.has(numberOf(n))))];

  const flaggedWords = [...new Set((text.match(ACCUSATORY) ?? []).map((w) => w.toLowerCase()))];

  const ids = new Set(facts.map((f) => f.id));
  const flaggedIds = new Set(facts.filter((f) => f.flagged).map((f) => f.id));
  const unknown = brief.cited_fact_ids.filter((id) => !ids.has(id));
  const citesFlagged = brief.cited_fact_ids.some((id) => flaggedIds.has(id));

  const holdReasons: string[] = [];
  if (unsupported.length) holdReasons.push(`Figures not in the screen results: ${unsupported.join(", ")}.`);
  if (flaggedWords.length) holdReasons.push(`Language that implies wrongdoing: ${flaggedWords.join(", ")}.`);
  if (unknown.length) holdReasons.push(`Citations to facts that don't exist: ${unknown.join(", ")}.`);
  if (!citesFlagged) holdReasons.push("The brief doesn't cite any flagged pattern.");
  if (brief.alternative_explanations.length === 0) holdReasons.push("The brief offers no alternative explanation.");

  return {
    status: holdReasons.length ? ("held" as const) : ("ready" as const),
    holdReasons,
    numberCheck: { found, unsupported },
    languageCheck: { flagged: flaggedWords },
    citationCheck: { cited: brief.cited_fact_ids, unknown, citesFlagged },
  };
}

export async function briefLead(lead: Lead, mode: "live" | "replay"): Promise<PiBrief> {
  const trace: TraceStep[] = [];
  const time = async <T>(name: string, fn: () => T | Promise<T>, detail: (r: T) => string): Promise<T> => {
    const t0 = performance.now();
    const r = await fn();
    trace.push({ name, ms: Math.round(performance.now() - t0), detail: detail(r) });
    return r;
  };

  const facts = await time("Screen results to facts", () => buildFacts(lead), (f) => `${f.length} facts, ${f.filter((x) => x.flagged).length} flagged; aggregates only, no member data`);

  let brief: BriefText;
  let model: string = MODEL;
  let usage: Usage | undefined;
  if (mode === "live") {
    const r = await time("Lead brief (LLM)", () => callModel(lead, facts), (x) => `${x.model}, ${x.usage.inputTokens} in / ${x.usage.outputTokens} out tokens`);
    brief = r.output;
    model = r.model;
    usage = r.usage;
  } else {
    const rec = (recorded.cases as Record<string, unknown>)[lead.providerId];
    if (!rec) throw new ReplayMissingError("No recorded brief for this lead yet. Switch to Live, or run npm run record:pi.");
    brief = await time("Lead brief (replay)", () => BriefOutput.parse(rec), () => `Loaded ${recorded.source === "live" ? "recorded live output" : "sample output written for the demo"}`);
    model = recorded.model;
  }

  const checked = await time(
    "Number + language + citation check",
    () => checkBrief(facts, brief),
    (c) => `${c.numberCheck.found.length} figures, ${c.numberCheck.unsupported.length} unsupported; ${c.languageCheck.flagged.length} flagged words; ${c.citationCheck.cited.length} citations`,
  );

  return {
    providerId: lead.providerId,
    mode,
    replaySource: mode === "replay" ? (recorded.source === "live" ? "live" : "sample") : undefined,
    model,
    ...checked,
    tier: lead.tier,
    action: actionFor(lead).action,
    brief,
    facts,
    trace,
    usage,
    generatedAt: new Date().toISOString(),
    raw: brief,
  };
}
