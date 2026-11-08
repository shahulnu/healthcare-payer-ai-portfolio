"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import type { CoveragePolicy, CriterionStatus, Evaluation, PaCase, Route } from "@/lib/pa/types";

type Result = Evaluation & { notice?: string };

const STATUS: Record<CriterionStatus, { label: string; cls: string; icon: string }> = {
  met: { label: "Met", cls: "p-ok", icon: "✓" },
  not_met: { label: "Not met", cls: "p-bad", icon: "✕" },
  insufficient: { label: "Insufficient", cls: "p-warn", icon: "?" },
};

const ROUTE: Record<Route, { label: string; cls: string }> = {
  recommend_approve: { label: "Recommend approval", cls: "route-ok" },
  request_info: { label: "Request more information", cls: "route-warn" },
  nurse_review: { label: "Send to nurse review", cls: "route-bad" },
};

function fmtDue(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" });
}

/** Wrap each quote that appears verbatim in the text in a <mark>. */
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

export function PaDemo({ cases, policies, initialCaseId }: { cases: PaCase[]; policies: CoveragePolicy[]; initialCaseId: string }) {
  const [caseId, setCaseId] = useState(initialCaseId);
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const c = cases.find((x) => x.id === caseId)!;
  const policy = policies.find((p) => p.serviceCodes.includes(c.service.code));

  const run = useCallback(async (id: string, m: "replay" | "live") => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/pa/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: id, mode: m }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(data.error ?? `Request failed (${res.status}).`);
      } else {
        setResult(data);
      }
    } catch {
      setError("Couldn't reach the evaluation service. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/pa/evaluate")
      .then((r) => r.json())
      .then((d) => setLiveAvailable(Boolean(d.liveAvailable)))
      .catch(() => setLiveAvailable(false));
  }, []);

  // Open in a working state: replay the selected case as soon as it is picked.
  useEffect(() => {
    setResult(null);
    run(caseId, "replay");
  }, [caseId, run]);

  const shown = result && result.caseId === caseId ? result : null;
  const quotesByDoc = new Map<string, string[]>();
  shown?.criteria.forEach((cr) =>
    cr.evidence.filter((e) => e.verified).forEach((e) => quotesByDoc.set(e.docId, [...(quotesByDoc.get(e.docId) ?? []), e.quote])),
  );

  return (
    <div className="wrap demo-page text-full">
      <section className="demo-head">
        <div>
          <span className="eyebrow">Prior Auth Copilot · demo</span>
          <h1 className="demo-title">Review queue</h1>
        </div>
        <div className="case-tabs" role="tablist" aria-label="Synthetic cases">
          {cases.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={x.id === caseId}
              className={x.id === caseId ? "case-tab on" : "case-tab"}
              onClick={() => setCaseId(x.id)}
            >
              <span className="mono">{x.id}</span>
              <span>{x.service.description}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="demo-grid">
        {/* Left: the request as the reviewer receives it */}
        <section className="demo-col" aria-label="Request and records">
          <div className="panel">
            <div className="row-between">
              <h2 className="h-sm">Request</h2>
              <span className={`pill ${c.urgency === "expedited" ? "p-bad" : "p-acc"}`}>{c.urgency === "expedited" ? "Expedited · 72 h" : "Standard · 7 days"}</span>
            </div>
            <dl className="kv">
              <dt>Member</dt>
              <dd>
                Synthetic {c.member.id}, {c.member.age} {c.member.sex}, {c.member.plan}
              </dd>
              <dt>Service</dt>
              <dd>
                <span className="mono">
                  {c.service.codeSystem} {c.service.code}
                </span>{" "}
                {c.service.description}
              </dd>
              <dt>Diagnosis</dt>
              <dd>{c.service.diagnosis.join("; ")}</dd>
              <dt>Provider</dt>
              <dd>
                {c.provider.name}, {c.provider.specialty}, {c.provider.network === "in" ? "in-network" : "out-of-network"}
              </dd>
              <dt>Policy</dt>
              <dd>
                {policy ? (
                  <>
                    <span className="mono">{policy.id}</span> {policy.title}
                  </>
                ) : (
                  "No matching policy"
                )}
              </dd>
            </dl>
          </div>
          {c.documents.map((d) => (
            <div className="panel" key={d.id}>
              <div className="row-between">
                <h2 className="h-sm">{d.title}</h2>
                <span className="mono muted">
                  {d.id} · {d.date}
                </span>
              </div>
              <pre className="doc">
                <Highlighted text={d.text} quotes={quotesByDoc.get(d.id) ?? []} />
              </pre>
            </div>
          ))}
        </section>

        {/* Right: the copilot's findings */}
        <section className="demo-col" aria-label="Copilot findings" aria-live="polite">
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
            <button className="btn" onClick={() => run(caseId, mode)} disabled={running}>
              {running ? "Evaluating…" : "Run evaluation"}
            </button>
            <span className="muted small">
              {liveAvailable ? "Live calls Claude Opus 5.5 (about 20–40 s)." : "Replay mode: live calls are off on this deployment."}
            </span>
          </div>

          {error && <div className="callout bad">{error}</div>}
          {!shown && !error && <div className="panel muted">{running ? "Evaluating the request against the policy…" : "Pick a case to evaluate."}</div>}

          {shown && (
            <>
              {shown.notice && <div className="callout">{shown.notice}</div>}
              <div className={`panel route ${ROUTE[shown.route].cls}`}>
                <div className="row-between">
                  <span className="eyebrow">Recommendation</span>
                  <span className="mono muted small">Decision due {fmtDue(shown.decisionDueBy)}</span>
                </div>
                <h2>{ROUTE[shown.route].label}</h2>
                <p>{shown.routeReason}</p>
                <p className="muted">{shown.summary}</p>
              </div>

              <div className="panel">
                <h2 className="h-sm">Policy criteria</h2>
                <ol className="crit-list">
                  {shown.criteria.map((cr) => (
                    <li key={cr.id} className="crit">
                      <div className="row-between">
                        <span>
                          <b className="mono">{cr.id}</b> {cr.text}
                        </span>
                        <span className={`pill ${STATUS[cr.status].cls}`}>
                          {STATUS[cr.status].icon} {STATUS[cr.status].label}
                        </span>
                      </div>
                      <p className="muted small">{cr.rationale}</p>
                      {cr.downgraded && (
                        <p className="small warn-text">
                          The model said &quot;{STATUS[cr.modelStatus].label.toLowerCase()}&quot;, but none of its quotes appear in the record, so this
                          was downgraded.
                        </p>
                      )}
                      {cr.evidence.length > 0 && (
                        <ul className="evidence">
                          {cr.evidence.map((e, i) => (
                            <li key={i} className={e.verified ? "ev ok" : "ev bad"}>
                              <span className="mono">{e.docId}</span> “{e.quote}”{" "}
                              <span className="small">{e.verified ? "✓ found in record" : "✕ not found in record"}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
                <div className="actions">
                  <button className="btn" disabled title="Reviewer actions are disabled in the demo">
                    Approve
                  </button>
                  <button className="btn ghost" disabled title="Reviewer actions are disabled in the demo">
                    Send to nurse review
                  </button>
                  <button className="btn ghost" disabled title="Reviewer actions are disabled in the demo">
                    Request info
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="row-between">
                  <h2 className="h-sm">Run trace</h2>
                  <span className={`pill ${shown.mode === "live" ? "p-ok" : "p-mute"}`}>{shown.mode === "live" ? `Live · ${shown.model}` : "Replay"}
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
      <p className="muted small">Synthetic members and illustrative policies. Not for clinical or coverage decisions.</p>
    </div>
  );
}
