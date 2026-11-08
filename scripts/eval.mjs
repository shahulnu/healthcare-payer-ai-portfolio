// Scores the Prior Auth Copilot against evals/labels.json through the running app's API.
//
//   npm run dev                      (in another terminal)
//   npm run eval                     replay mode, no API calls
//   npm run eval -- --live           calls Claude for every case (costs money)
//   npm run eval -- --live --record  also saves the live outputs as the demo's replay data
//
// Writes a full report to evals/results/. Live runs also write the headline numbers to
// src/lib/pa/eval-summary.json, which the case study page displays.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const record = args.has("--record");
const base = process.env.BASE_URL ?? "http://localhost:3000";

if (record && !live) {
  console.error("--record needs --live.");
  process.exit(1);
}

const labels = JSON.parse(readFileSync("evals/labels.json", "utf8")).cases;
const rows = [];
const recorded = {};
let model = "";

for (const [caseId, label] of Object.entries(labels)) {
  const res = await fetch(`${base}/api/pa/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, mode: live ? "live" : "replay" }),
  });
  const r = await res.json();
  if (!res.ok) {
    console.error(`${caseId}: ${r.error}`);
    process.exit(1);
  }
  if (live && r.mode !== "live") {
    console.error(`${caseId}: the server ran a replay (${r.notice ?? "no API key?"}). Stopping.`);
    process.exit(1);
  }
  model = r.model;
  recorded[caseId] = r.raw;

  const criteria = r.criteria.map((c) => ({
    id: c.id,
    expected: label.criteria[c.id],
    actual: c.status,
    correct: c.status === label.criteria[c.id],
    quotes: c.evidence.length,
    verified: c.evidence.filter((e) => e.verified).length,
  }));
  rows.push({
    caseId,
    expectedRoute: label.route,
    route: r.route,
    routeCorrect: r.route === label.route,
    unsafeApproval: r.route === "recommend_approve" && label.route !== "recommend_approve",
    criteria,
    usage: r.usage ?? null,
  });

  const mark = (ok) => (ok ? "ok " : "XX ");
  console.log(`${mark(rows.at(-1).routeCorrect)}${caseId}  route ${r.route} (expected ${label.route})`);
  for (const c of criteria) console.log(`     ${mark(c.correct)}${c.id} ${c.actual} (expected ${c.expected}), ${c.verified}/${c.quotes} quotes verified`);
}

const allCriteria = rows.flatMap((r) => r.criteria);
const quotes = allCriteria.reduce((a, c) => a + c.quotes, 0);
const summary = {
  mode: live ? "live" : "replay",
  model,
  runAt: new Date().toISOString(),
  cases: rows.length,
  criteria: allCriteria.length,
  criterionAccuracy: allCriteria.filter((c) => c.correct).length / allCriteria.length,
  routeAccuracy: rows.filter((r) => r.routeCorrect).length / rows.length,
  citationVerifiedRate: quotes ? allCriteria.reduce((a, c) => a + c.verified, 0) / quotes : null,
  unsafeApprovals: rows.filter((r) => r.unsafeApproval).length,
};
if (live) {
  summary.totalCostUsd = Number(rows.reduce((a, r) => a + (r.usage?.estCostUsd ?? 0), 0).toFixed(4));
}

mkdirSync("evals/results", { recursive: true });
const stamp = summary.runAt.replace(/[:.]/g, "-");
writeFileSync(`evals/results/${stamp}-${summary.mode}.json`, JSON.stringify({ summary, rows }, null, 2));
// Only live runs measure the model, so only they update the numbers the site shows.
if (live) writeFileSync("src/lib/pa/eval-summary.json", JSON.stringify(summary, null, 2) + "\n");

if (record) {
  const file = {
    source: "live",
    note: `Recorded from a live run on ${summary.runAt.slice(0, 10)}.`,
    model,
    cases: recorded,
  };
  writeFileSync("data/pa/recorded.json", JSON.stringify(file, null, 2) + "\n");
  console.log("Saved live outputs to data/pa/recorded.json for replay mode.");
}

const pct = (x) => (x === null ? "n/a" : `${(x * 100).toFixed(0)}%`);
console.log(
  `\n${summary.mode.toUpperCase()}  criteria ${pct(summary.criterionAccuracy)}  routing ${pct(summary.routeAccuracy)}  ` +
    `citations verified ${pct(summary.citationVerifiedRate)}  unsafe approvals ${summary.unsafeApprovals}` +
    (live ? `  cost $${summary.totalCostUsd}` : ""),
);
