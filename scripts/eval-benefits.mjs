// Scores the Benefits Navigator against evals/benefits-labels.json through the running app's API.
//
//   npm run dev                               (in another terminal)
//   npm run eval:benefits                     replay mode, no API calls
//   npm run eval:benefits -- --live           calls Claude for every sample question (costs money)
//   npm run record:benefits                   live run, then saves the runs as the demo's replay data
//
// Writes a full report to evals/results/. Live runs also write the headline numbers to
// src/lib/benefits/eval-summary.json, which the case study page displays.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const record = args.has("--record");
const base = process.env.BASE_URL ?? "http://localhost:3000";

if (record && !live) {
  console.error("--record needs --live.");
  process.exit(1);
}

const labels = JSON.parse(readFileSync("evals/benefits-labels.json", "utf8")).questions;
const rows = [];
const recorded = {};
let model = "";

// "$586" and "$586.00" both count as stating 586.
const statesAmount = (text, amount) =>
  [`$${amount.toLocaleString("en-US")}`, `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`].some((s) =>
    new RegExp(`\\${s.replace(/[.]/g, "\\.")}(?![\\d.,]*\\d)`).test(text),
  );

for (const [questionId, label] of Object.entries(labels)) {
  const res = await fetch(`${base}/api/benefits/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, mode: live ? "live" : "replay" }),
  });
  const r = await res.json();
  if (!res.ok) {
    console.error(`${questionId}: ${r.error}`);
    process.exit(1);
  }
  if (live && r.mode !== "live") {
    console.error(`${questionId}: the server ran a replay (${r.notice ?? "no API key?"}). Stopping.`);
    process.exit(1);
  }
  model = r.model;
  recorded[questionId] = r.raw;

  const routingCorrect = r.status === label.status;
  let costCorrect = null;
  if (label.cost) {
    const est = r.estimates.find((e) => e.serviceId === label.cost.service && e.network === label.cost.network);
    costCorrect = r.status === "answered" && !!est && est.memberPays === label.cost.amount && statesAmount(r.answer, label.cost.amount);
  }
  const quotes = r.citations.length;
  const verified = r.citations.filter((c) => c.verified).length;
  rows.push({
    questionId,
    expectedStatus: label.status,
    status: r.status,
    routingCorrect,
    costCorrect,
    quotes,
    verified,
    unsupportedShown: r.status === "answered" ? r.numberCheck.unsupported.length : 0,
    blockedByChecks: r.status === "escalated" && label.status === "answered",
    escalationReason: r.escalationReason,
    usage: r.usage ?? null,
  });

  const mark = routingCorrect && costCorrect !== false ? "ok " : "XX ";
  console.log(
    `${mark}${questionId}: ${r.status} (expected ${label.status})` +
      (label.cost ? `, cost ${costCorrect ? "correct" : "WRONG"} (expected $${label.cost.amount})` : "") +
      `, ${verified}/${quotes} quotes verified, ${r.toolCalls.length} tool calls` +
      (r.escalationReason && r.status !== label.status ? `\n     reason: ${r.escalationReason}` : ""),
  );
}

const costRows = rows.filter((r) => r.costCorrect !== null);
const quoteTotal = rows.reduce((a, r) => a + r.quotes, 0);
const summary = {
  mode: live ? "live" : "replay",
  model,
  runAt: new Date().toISOString(),
  questions: rows.length,
  routingAccuracy: rows.filter((r) => r.routingCorrect).length / rows.length,
  costAccuracy: costRows.length ? costRows.filter((r) => r.costCorrect).length / costRows.length : null,
  citationVerifiedRate: quoteTotal ? rows.reduce((a, r) => a + r.verified, 0) / quoteTotal : null,
  unsupportedShown: rows.reduce((a, r) => a + r.unsupportedShown, 0),
};
if (live) summary.totalCostUsd = Number(rows.reduce((a, r) => a + (r.usage?.estCostUsd ?? 0), 0).toFixed(4));

mkdirSync("evals/results", { recursive: true });
const stamp = summary.runAt.replace(/[:.]/g, "-");
writeFileSync(`evals/results/${stamp}-benefits-${summary.mode}.json`, JSON.stringify({ summary, rows }, null, 2));
// Only live runs measure the model, so only they update the numbers the site shows.
if (live) writeFileSync("src/lib/benefits/eval-summary.json", JSON.stringify(summary, null, 2) + "\n");

if (record) {
  writeFileSync(
    "data/benefits/recorded.json",
    JSON.stringify({ source: "live", note: `Recorded from a live run on ${summary.runAt.slice(0, 10)}.`, model, cases: recorded }, null, 2) + "\n",
  );
  console.log("Saved live runs to data/benefits/recorded.json for replay mode.");
}

const pct = (x) => (x === null ? "n/a" : `${(x * 100).toFixed(0)}%`);
const blocked = rows.filter((r) => r.blockedByChecks).length;
console.log(
  `\n${summary.mode.toUpperCase()}  routing ${pct(summary.routingAccuracy)}  cost ${pct(summary.costAccuracy)}  ` +
    `citations verified ${pct(summary.citationVerifiedRate)}  unsupported figures shown ${summary.unsupportedShown}` +
    (blocked ? `  (${blocked} answers held back by the checks)` : "") +
    (live ? `  cost $${summary.totalCostUsd}` : ""),
);
