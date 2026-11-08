// Scores the Denial & Appeals Assistant against evals/appeals-labels.json through the running app's API.
//
//   npm run dev                              (in another terminal)
//   npm run eval:appeals                     replay mode, no API calls
//   npm run eval:appeals -- --live           calls Claude for every claim (costs money)
//   npm run record:appeals                   live run, then saves outputs as the demo's replay data
//
// Writes a full report to evals/results/. Live runs also write the headline numbers to
// src/lib/appeals/eval-summary.json, which the case study page displays.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const record = args.has("--record");
const base = process.env.BASE_URL ?? "http://localhost:3000";

if (record && !live) {
  console.error("--record needs --live.");
  process.exit(1);
}

const labels = JSON.parse(readFileSync("evals/appeals-labels.json", "utf8")).claims;
const rows = [];
const recorded = {};
let model = "";

for (const [claimId, lineLabels] of Object.entries(labels)) {
  const res = await fetch(`${base}/api/appeals/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimId, mode: live ? "live" : "replay" }),
  });
  const r = await res.json();
  if (!res.ok) {
    console.error(`${claimId}: ${r.error}`);
    process.exit(1);
  }
  if (live && r.mode !== "live") {
    console.error(`${claimId}: the server ran a replay (${r.notice ?? "no API key?"}). Stopping.`);
    process.exit(1);
  }
  model = r.model;
  recorded[claimId] = r.raw;

  const lines = r.findings.map((f) => {
    const label = lineLabels[String(f.line)];
    return {
      line: f.line,
      expectedAction: label?.action,
      action: f.action,
      actionCorrect: f.action === label?.action,
      expectedCategory: label?.category,
      category: f.category,
      categoryCorrect: f.category === label?.category,
      unsupported: f.action !== "no_action" && label?.action === "no_action",
      quotes: f.evidence.length,
      verified: f.evidence.filter((e) => e.verified).length,
    };
  });
  rows.push({ claimId, lines, letter: r.letter ? { quotes: r.letter.quotes, verified: r.letter.quotesVerified } : null, usage: r.usage ?? null });

  console.log(claimId);
  for (const l of lines) {
    const mark = l.actionCorrect && l.categoryCorrect ? "ok " : "XX ";
    console.log(
      `  ${mark}line ${l.line}: ${l.action} (expected ${l.expectedAction}), ${l.category} (expected ${l.expectedCategory}), ${l.verified}/${l.quotes} quotes verified`,
    );
  }
  if (r.letter) console.log(`     letter: ${r.letter.quotesVerified}/${r.letter.quotes} quoted passages verified`);
}

const all = rows.flatMap((r) => r.lines);
const quotes = all.reduce((a, l) => a + l.quotes, 0);
const summary = {
  mode: live ? "live" : "replay",
  model,
  runAt: new Date().toISOString(),
  claims: rows.length,
  lines: all.length,
  actionAccuracy: all.filter((l) => l.actionCorrect).length / all.length,
  categoryAccuracy: all.filter((l) => l.categoryCorrect).length / all.length,
  citationVerifiedRate: quotes ? all.reduce((a, l) => a + l.verified, 0) / quotes : null,
  unsupportedAppeals: all.filter((l) => l.unsupported).length,
};
if (live) summary.totalCostUsd = Number(rows.reduce((a, r) => a + (r.usage?.estCostUsd ?? 0), 0).toFixed(4));

mkdirSync("evals/results", { recursive: true });
const stamp = summary.runAt.replace(/[:.]/g, "-");
writeFileSync(`evals/results/${stamp}-appeals-${summary.mode}.json`, JSON.stringify({ summary, rows }, null, 2));
// Only live runs measure the model, so only they update the numbers the site shows.
if (live) writeFileSync("src/lib/appeals/eval-summary.json", JSON.stringify(summary, null, 2) + "\n");

if (record) {
  writeFileSync(
    "data/appeals/recorded.json",
    JSON.stringify({ source: "live", note: `Recorded from a live run on ${summary.runAt.slice(0, 10)}.`, model, cases: recorded }, null, 2) + "\n",
  );
  console.log("Saved live outputs to data/appeals/recorded.json for replay mode.");
}

const pct = (x) => (x === null ? "n/a" : `${(x * 100).toFixed(0)}%`);
console.log(
  `\n${summary.mode.toUpperCase()}  actions ${pct(summary.actionAccuracy)}  categories ${pct(summary.categoryAccuracy)}  ` +
    `citations verified ${pct(summary.citationVerifiedRate)}  unsupported appeals ${summary.unsupportedAppeals}` +
    (live ? `  cost $${summary.totalCostUsd}` : ""),
);
