// Scores the HCC Evidence Finder against evals/hcc-labels.json through the running app's API.
//
//   npm run dev                         (in another terminal)
//   npm run eval:hcc                    replay mode, no API calls
//   npm run eval:hcc -- --live          calls Claude for every chart (costs money)
//   npm run record:hcc                  live run, then saves the reviews as the demo's replay data
//
// Writes a full report to evals/results/. Live runs also write the headline numbers to
// src/lib/hcc/eval-summary.json, which the case study page displays.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const record = args.has("--record");
const base = process.env.BASE_URL ?? "http://localhost:3000";

if (record && !live) {
  console.error("--record needs --live.");
  process.exit(1);
}

const labels = JSON.parse(readFileSync("evals/hcc-labels.json", "utf8")).members;
const rows = [];
const recorded = {};
let model = "";

for (const [memberId, label] of Object.entries(labels)) {
  const res = await fetch(`${base}/api/hcc/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, mode: live ? "live" : "replay" }),
  });
  const r = await res.json();
  if (!res.ok) {
    console.error(`${memberId}: ${r.error}`);
    process.exit(1);
  }
  if (live && r.mode !== "live") {
    console.error(`${memberId}: the server ran a replay (${r.notice ?? "no API key?"}). Stopping.`);
    process.exit(1);
  }
  model = r.model;
  recorded[memberId] = r.raw;

  console.log(memberId);
  const codes = Object.entries(label.expected).map(([code, accepted]) => {
    const f = r.findings.find((x) => x.code === code);
    const correct = !!f && accepted.includes(f.disposition);
    console.log(`  ${correct ? "ok " : "XX "}${code}: ${f?.disposition ?? "not found"} (expected ${accepted.join(" or ")})${f?.codeNote ? ` [code: ${f.codeNote}]` : ""}`);
    return { code, accepted, disposition: f?.disposition ?? null, correct };
  });
  const forbiddenHits = r.findings.filter((f) => label.forbidden.includes(f.code) && ["add", "confirmed"].includes(f.disposition)).map((f) => f.code);
  for (const code of label.forbidden) {
    const f = r.findings.find((x) => x.code === code);
    console.log(`  ${forbiddenHits.includes(code) ? "XX " : "ok "}${code} must not be suggested: ${f?.disposition ?? "not raised"}`);
  }
  const evidence = r.findings.flatMap((f) => f.evidence);
  rows.push({
    memberId,
    codes,
    forbiddenHits,
    quotes: evidence.length,
    verified: evidence.filter((e) => e.verified).length,
    codeOverrides: r.findings.filter((f) => f.codeNote).length,
    usage: r.usage ?? null,
  });
}

const all = rows.flatMap((r) => r.codes);
const adds = all.filter((c) => c.accepted.includes("add"));
const deletions = all.filter((c) => c.accepted.includes("review_deletion") && !c.accepted.includes("superseded"));
const quotes = rows.reduce((a, r) => a + r.quotes, 0);
const summary = {
  mode: live ? "live" : "replay",
  model,
  runAt: new Date().toISOString(),
  charts: rows.length,
  codes: all.length,
  dispositionAccuracy: all.filter((c) => c.correct).length / all.length,
  addsFound: adds.length ? adds.filter((c) => c.correct).length / adds.length : null,
  unsupportedCaught: deletions.length ? deletions.filter((c) => c.correct).length / deletions.length : null,
  citationVerifiedRate: quotes ? rows.reduce((a, r) => a + r.verified, 0) / quotes : null,
  forbiddenSuggested: rows.reduce((a, r) => a + r.forbiddenHits.length, 0),
};
if (live) summary.totalCostUsd = Number(rows.reduce((a, r) => a + (r.usage?.estCostUsd ?? 0), 0).toFixed(4));

mkdirSync("evals/results", { recursive: true });
const stamp = summary.runAt.replace(/[:.]/g, "-");
writeFileSync(`evals/results/${stamp}-hcc-${summary.mode}.json`, JSON.stringify({ summary, rows }, null, 2));
// Only live runs measure the model, so only they update the numbers the site shows.
if (live) writeFileSync("src/lib/hcc/eval-summary.json", JSON.stringify(summary, null, 2) + "\n");

if (record) {
  writeFileSync(
    "data/hcc/recorded.json",
    JSON.stringify({ source: "live", note: `Recorded from a live run on ${summary.runAt.slice(0, 10)}.`, model, cases: recorded }, null, 2) + "\n",
  );
  console.log("Saved live reviews to data/hcc/recorded.json for replay mode.");
}

const pct = (x) => (x === null ? "n/a" : `${(x * 100).toFixed(0)}%`);
console.log(
  `\n${summary.mode.toUpperCase()}  dispositions ${pct(summary.dispositionAccuracy)}  adds found ${pct(summary.addsFound)}  unsupported caught ${pct(summary.unsupportedCaught)}  ` +
    `citations verified ${pct(summary.citationVerifiedRate)}  forbidden suggested ${summary.forbiddenSuggested}` +
    (live ? `  cost $${summary.totalCostUsd}` : ""),
);
