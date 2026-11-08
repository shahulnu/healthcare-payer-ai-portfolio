// Scores Payment Integrity Radar against evals/pi-labels.json through the running app's API.
//
//   npm run dev                         (in another terminal)
//   npm run eval:pi                     screen metrics plus replayed briefs, no API calls
//   npm run eval:pi -- --live           calls Claude for every lead (costs money)
//   npm run record:pi                   live run, then saves the briefs as the demo's replay data
//
// Writes a full report to evals/results/. Live runs also write the headline numbers to
// src/lib/pi/eval-summary.json, which the case study page displays.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const record = args.has("--record");
const base = process.env.BASE_URL ?? "http://localhost:3000";

if (record && !live) {
  console.error("--record needs --live.");
  process.exit(1);
}

const { injected, decoys } = JSON.parse(readFileSync("evals/pi-labels.json", "utf8"));
const screen = await (await fetch(`${base}/api/pi/leads`)).json();

// The screen: no model involved.
const leadIds = screen.leads.map((l) => l.providerId);
const truePositives = leadIds.filter((id) => injected[id]);
const foundOnPattern = Object.entries(injected).filter(([id, label]) => {
  const lead = screen.leads.find((l) => l.providerId === id);
  return lead?.features.some((f) => f.id === label.pattern && f.flagged);
});
const tierMatches = truePositives.filter((id) => screen.leads.find((l) => l.providerId === id).tier === injected[id].tier);
const decoysCleared = decoys.filter((id) => !leadIds.includes(id));

console.log(`Screen: ${leadIds.length} leads from ${screen.cohortSize} providers`);
for (const l of screen.leads) {
  const label = injected[l.providerId];
  console.log(`  ${label ? "ok " : "XX "}${l.providerId} ${l.tier} (score ${l.score})${label ? `, injected ${label.pattern} at ${label.tier}` : ", NOT injected"}`);
}
for (const id of decoys) console.log(`  ${decoysCleared.includes(id) ? "ok " : "XX "}${id} decoy ${decoysCleared.includes(id) ? "cleared" : "BECAME A LEAD"}`);

// The briefs.
const rows = [];
const recorded = {};
let model = "";
for (const lead of screen.leads) {
  const res = await fetch(`${base}/api/pi/brief`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId: lead.providerId, mode: live ? "live" : "replay" }),
  });
  const r = await res.json();
  if (!res.ok) {
    console.error(`${lead.providerId}: ${r.error}`);
    process.exit(1);
  }
  if (live && r.mode !== "live") {
    console.error(`${lead.providerId}: the server ran a replay (${r.notice ?? "no API key?"}). Stopping.`);
    process.exit(1);
  }
  model = r.model;
  recorded[lead.providerId] = r.raw;
  const label = injected[lead.providerId];
  const citesPattern = label ? r.citationCheck.cited.includes(`F-${label.pattern}`) : null;
  rows.push({
    providerId: lead.providerId,
    status: r.status,
    holdReasons: r.holdReasons,
    citesPattern,
    figures: r.numberCheck.found.length,
    unsupported: r.numberCheck.unsupported,
    flaggedWords: r.languageCheck.flagged,
    alternatives: r.brief.alternative_explanations.length,
    usage: r.usage ?? null,
  });
  const ok = r.status === "ready" && citesPattern !== false;
  console.log(
    `${ok ? "ok " : "XX "}${lead.providerId} brief: ${r.status}, ${r.numberCheck.found.length} figures, ${r.brief.alternative_explanations.length} alternatives` +
      (citesPattern === false ? ", MISSING the injected pattern" : "") +
      (r.holdReasons.length ? `\n     ${r.holdReasons.join(" ")}` : ""),
  );
}

const labeled = rows.filter((r) => r.citesPattern !== null);
const summary = {
  mode: live ? "live" : "replay",
  model,
  runAt: new Date().toISOString(),
  leads: leadIds.length,
  precision: leadIds.length ? truePositives.length / leadIds.length : null,
  recall: foundOnPattern.length / Object.keys(injected).length,
  tierAccuracy: truePositives.length ? tierMatches.length / truePositives.length : null,
  decoysCleared: decoys.length ? decoysCleared.length / decoys.length : null,
  briefsPassed: rows.length ? rows.filter((r) => r.status === "ready").length / rows.length : null,
  briefsCiteRightPattern: labeled.length ? labeled.filter((r) => r.citesPattern).length / labeled.length : null,
};
if (live) summary.totalCostUsd = Number(rows.reduce((a, r) => a + (r.usage?.estCostUsd ?? 0), 0).toFixed(4));

mkdirSync("evals/results", { recursive: true });
const stamp = summary.runAt.replace(/[:.]/g, "-");
writeFileSync(`evals/results/${stamp}-pi-${summary.mode}.json`, JSON.stringify({ summary, rows }, null, 2));
// Only live runs measure the model, so only they update the numbers the site shows.
if (live) writeFileSync("src/lib/pi/eval-summary.json", JSON.stringify(summary, null, 2) + "\n");

if (record) {
  writeFileSync(
    "data/pi/recorded.json",
    JSON.stringify({ source: "live", note: `Recorded from a live run on ${summary.runAt.slice(0, 10)}.`, model, cases: recorded }, null, 2) + "\n",
  );
  console.log("Saved live briefs to data/pi/recorded.json for replay mode.");
}

const pct = (x) => (x === null ? "n/a" : `${(x * 100).toFixed(0)}%`);
console.log(
  `\n${summary.mode.toUpperCase()}  precision ${pct(summary.precision)}  recall ${pct(summary.recall)}  tiers ${pct(summary.tierAccuracy)}  decoys cleared ${pct(summary.decoysCleared)}  ` +
    `briefs passed ${pct(summary.briefsPassed)}  right pattern ${pct(summary.briefsCiteRightPattern)}` +
    (live ? `  cost $${summary.totalCostUsd}` : ""),
);
