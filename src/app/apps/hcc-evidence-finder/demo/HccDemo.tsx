"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import type { ChartMember, Disposition, Finding, HccMap, HccReview, MeatElement } from "@/lib/hcc/types";

type Result = HccReview & { notice?: string };

const DISPOSITION: Record<Disposition, { label: string; cls: string; icon: string }> = {
  review_deletion: { label: "Review for deletion", cls: "p-bad", icon: "✕" },
  add: { label: "Suggest adding", cls: "p-ok", icon: "+" },
  query_provider: { label: "Query the provider", cls: "p-warn", icon: "?" },
  confirmed: { label: "Confirmed", cls: "p-ok", icon: "✓" },
  superseded: { label: "Replaced by hierarchy", cls: "p-mute", icon: "↑" },
  no_hcc: { label: "No HCC", cls: "p-mute", icon: "–" },
  no_action: { label: "No action", cls: "p-mute", icon: "–" },
};

const MEAT: { key: MeatElement; name: string }[] = [
  { key: "M", name: "Monitor" },
  { key: "E", name: "Evaluate" },
  { key: "A", name: "Assess" },
  { key: "T", name: "Treat" },
];

function Highlighted({ text, quotes }: { text: string; quotes: string[] }) {
  const ranges: [number, number][] = [];
  for (const q of quotes) {
    const i = text.indexOf(q);
    if (i >= 0) ranges.push([i, i + q.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], k) => {
    if (s < pos) return;
    parts.push(<Fragment key={`t${k}`}>{text.slice(pos, s)}</Fragment>);
    parts.push(<mark key={`m${k}`}>{text.slice(s, e)}</mark>);
    pos = e;
  });
  parts.push(<Fragment key="end">{text.slice(pos)}</Fragment>);
  return <>{parts}</>;
}

export function HccDemo({ members, map, initialMemberId }: { members: ChartMember[]; map: HccMap; initialMemberId: string }) {
  const [memberId, setMemberId] = useState(initialMemberId);
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const member = members.find((m) => m.id === memberId)!;

  const run = useCallback(async (id: string, m: "replay" | "live") => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/hcc/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: id, mode: m }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(data.error ?? `Request failed (${res.status}).`);
      } else {
        setResult(data);
      }
    } catch {
      setError("Couldn't reach the review service. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/hcc/review")
      .then((r) => r.json())
      .then((d) => setLiveAvailable(Boolean(d.liveAvailable)))
      .catch(() => setLiveAvailable(false));
  }, []);

  // Open in a working state: replay the selected chart as soon as it is picked.
  useEffect(() => {
    setResult(null);
    run(memberId, "replay");
  }, [memberId, run]);

  const shown = result && result.memberId === memberId ? result : null;
  const quotesByDoc = new Map<string, string[]>();
  shown?.findings.forEach((f) =>
    f.evidence.filter((e) => e.verified).forEach((e) => quotesByDoc.set(e.docId, [...(quotesByDoc.get(e.docId) ?? []), e.quote])),
  );

  return (
    <div className="wrap demo-page text-full">
      <section className="demo-head">
        <div>
          <span className="eyebrow">HCC Evidence Finder · demo · {map.model}</span>
          <h1 className="demo-title">Chart review</h1>
        </div>
        <div className="case-tabs" role="tablist" aria-label="Synthetic members">
          {members.map((m) => (
            <button key={m.id} role="tab" aria-selected={m.id === memberId} className={m.id === memberId ? "case-tab on" : "case-tab"} onClick={() => setMemberId(m.id)}>
              <span className="mono">{m.id}</span>
              <span>{m.teaser}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="demo-grid">
        {/* Left: what was submitted, and the chart */}
        <section className="demo-col" aria-label="Submitted codes and chart">
          <div className="panel">
            <div className="row-between">
              <h2 className="h-sm">Already submitted</h2>
              <span className="muted small">{member.label}</span>
            </div>
            <ul className="code-chips">
              {member.submitted.map((code) => {
                const e = map.codes[code];
                return (
                  <li key={code}>
                    <b className="mono">{code}</b> <span className="small">{e?.description}</span>
                    {e?.hcc && <span className="mono muted small"> · HCC {e.hcc}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
          {member.documents.map((d) => (
            <div className="panel" key={d.id}>
              <div className="row-between">
                <h2 className="h-sm">{d.title}</h2>
                <span className={`pill ${d.acceptable ? "p-ok" : "p-warn"}`}>{d.acceptable ? "✓ Can support a code" : "⚠ Can't support a code"}</span>
              </div>
              <span className="mono muted small">
                {d.id} · {d.date} · {d.encounterType} · {d.provider}
              </span>
              <pre className="doc">
                <Highlighted text={d.text} quotes={quotesByDoc.get(d.id) ?? []} />
              </pre>
            </div>
          ))}
        </section>

        {/* Right: findings for the coder */}
        <section className="demo-col" aria-label="Findings" aria-live="polite">
          <div className="panel run-bar">
            <div className="seg" role="radiogroup" aria-label="Mode">
              <button role="radio" aria-checked={mode === "replay"} className={mode === "replay" ? "on" : ""} onClick={() => setMode("replay")}>
                Replay
              </button>
              <button
                role="radio"
                aria-checked={mode === "live"}
                className={mode === "live" ? "on" : ""}
                onClick={() => setMode("live")}
                disabled={!liveAvailable}
                title={liveAvailable ? "Call Claude now" : "Live mode needs an API key on the server"}
              >
                Live
              </button>
            </div>
            <button className="btn" onClick={() => run(memberId, mode)} disabled={running}>
              {running ? "Reviewing…" : "Review chart"}
            </button>
            <span className="muted small">{liveAvailable ? "Live calls Claude Opus 5.5 (about 15–30 s)." : "Replay mode: live calls are off on this deployment."}</span>
          </div>

          {error && <div className="callout bad">{error}</div>}
          {!shown && !error && <div className="panel muted">{running ? "Reading the chart…" : "Pick a chart."}</div>}

          {shown && (
            <>
              {shown.notice && <div className="callout">{shown.notice}</div>}
              <div className="panel route route-ok">
                <span className="eyebrow">For the certified coder</span>
                <div className="stats">
                  <span>
                    <b>{shown.counts.add}</b>to add
                  </span>
                  <span>
                    <b>{shown.counts.review_deletion}</b>to review for deletion
                  </span>
                  <span>
                    <b>{shown.counts.query_provider}</b>to query
                  </span>
                  <span>
                    <b>{shown.counts.confirmed}</b>confirmed
                  </span>
                </div>
                <p>{shown.summary}</p>
                <p className="muted small">Nothing is submitted or deleted automatically. A coder decides every line.</p>
              </div>

              {shown.findings.map((f) => (
                <FindingCard key={f.code} f={f} />
              ))}

              <div className="panel">
                <div className="row-between">
                  <h2 className="h-sm">Run trace</h2>
                  <span className={`pill ${shown.mode === "live" ? "p-ok" : "p-mute"}`}>
                    {shown.mode === "live" ? `Live · ${shown.model}` : shown.replaySource === "live" ? "Replay of a recorded live run" : "Replay · sample output"}
                    {shown.engine === "java" ? " · Java engine" : ""}
                  </span>
                </div>
                <div className="tablewrap">
                  <table>
                    <tbody>
                      {shown.trace.map((t) => (
                        <tr key={t.name}>
                          <td>{t.name}</td>
                          <td className="muted">{t.detail}</td>
                          <td className="num mono">{t.ms} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted small">
                  Redacted before the model call: {shown.redactions.map((r) => `${r.label} ×${r.count}`).join(", ") || "nothing"}.
                  {shown.usage && ` Tokens: ${shown.usage.inputTokens.toLocaleString()} in / ${shown.usage.outputTokens.toLocaleString()} out, about $${shown.usage.estCostUsd.toFixed(3)}.`}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
      <p className="muted small">Synthetic charts. {map.note}</p>
    </div>
  );
}

function FindingCard({ f }: { f: Finding }) {
  const d = DISPOSITION[f.disposition];
  return (
    <div className="panel finding">
      <div className="row-between">
        <span>
          <b className="mono">{f.code}</b> {f.description}
        </span>
        <span className={`pill ${d.cls}`}>
          {d.icon} {d.label}
        </span>
      </div>
      <div className="row-between small">
        <span className="muted">
          {f.hcc ? `HCC ${f.hcc}${f.hccName ? `: ${f.hccName}` : ""}` : "No payment HCC"}
          {f.submitted ? " · already submitted" : " · not submitted"}
        </span>
        <span className="meat" aria-label={`MEAT elements met: ${f.meatMet.join(", ") || "none"}`}>
          {MEAT.map((m) => (
            <span key={m.key} className={f.meatMet.includes(m.key) ? "meat-chip on" : "meat-chip"} title={m.name}>
              {m.key}
            </span>
          ))}
        </span>
      </div>
      <p className="small">{f.rationale}</p>
      {f.codeNote && <p className="small warn-text">⚠ {f.codeNote}</p>}
      {f.evidence.length > 0 && (
        <ul className="evidence">
          {f.evidence.map((e, i) => (
            <li key={i} className={e.verified && e.acceptableSource ? "ev ok" : "ev bad"}>
              <b className="mono">{e.element}</b> <span className="mono">{e.docId}</span> “{e.quote}”{" "}
              <span className="small">{!e.verified ? "✕ not found in chart" : e.acceptableSource ? "✓ in chart" : "✕ encounter can't support a code"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
