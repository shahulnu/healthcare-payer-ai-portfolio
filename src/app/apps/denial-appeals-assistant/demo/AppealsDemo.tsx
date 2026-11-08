"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import type { Action, Analysis, Category, DeniedClaim, Strength } from "@/lib/appeals/types";

type Result = Analysis & { notice?: string };
type Codes = { CARC: Record<string, string>; RARC: Record<string, string>; GROUP_CODES: Record<string, string> };

const ACTION: Record<Action, { label: string; cls: string }> = {
  appeal: { label: "Appeal", cls: "p-ok" },
  corrected_claim: { label: "Corrected claim", cls: "p-acc" },
  no_action: { label: "Don't pursue", cls: "p-mute" },
};
const STRENGTH: Record<Strength, { label: string; cls: string }> = {
  strong: { label: "Strong case", cls: "p-ok" },
  moderate: { label: "Moderate case", cls: "p-warn" },
  weak: { label: "Weak case", cls: "p-bad" },
};
const CATEGORY: Record<Category, string> = {
  medical_necessity: "Medical necessity",
  authorization: "Authorization",
  coding: "Coding / bundling",
  timely_filing: "Timely filing",
  duplicate: "Duplicate",
  eligibility: "Eligibility",
  documentation: "Documentation",
  other: "Other",
};

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

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

function codeMeaning(codes: Codes, code: string) {
  if (code.includes("-")) {
    const [group, carc] = code.split("-");
    return `${codes.GROUP_CODES[group] ?? group} ${codes.CARC[carc] ?? ""}`;
  }
  return codes.RARC[code] ?? "";
}

export function AppealsDemo({ claims, codes, initialClaimId }: { claims: DeniedClaim[]; codes: Codes; initialClaimId: string }) {
  const [claimId, setClaimId] = useState(initialClaimId);
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const c = claims.find((x) => x.id === claimId)!;
  const denied = c.lines.filter((l) => l.paid === 0);

  const run = useCallback(async (id: string, m: "replay" | "live") => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/appeals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: id, mode: m }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(data.error ?? `Request failed (${res.status}).`);
      } else {
        setResult(data);
      }
    } catch {
      setError("Couldn't reach the analysis service. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/appeals/analyze")
      .then((r) => r.json())
      .then((d) => setLiveAvailable(Boolean(d.liveAvailable)))
      .catch(() => setLiveAvailable(false));
  }, []);

  // Open in a working state: replay the selected claim as soon as it is picked.
  useEffect(() => {
    setResult(null);
    run(claimId, "replay");
  }, [claimId, run]);

  const shown = result && result.claimId === claimId ? result : null;
  const quotesByDoc = new Map<string, string[]>();
  shown?.findings.forEach((f) =>
    f.evidence.filter((e) => e.verified && e.fromRecord).forEach((e) => quotesByDoc.set(e.docId, [...(quotesByDoc.get(e.docId) ?? []), e.quote])),
  );

  async function copyLetter(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the letter text stays selectable.
    }
  }

  return (
    <div className="wrap demo-page text-full">
      <section className="demo-head">
        <div>
          <span className="eyebrow">Denial & Appeals Assistant · demo</span>
          <h1 className="demo-title">Denied claims</h1>
        </div>
        <div className="case-tabs" role="tablist" aria-label="Synthetic claims">
          {claims.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === claimId} className={x.id === claimId ? "case-tab on" : "case-tab"} onClick={() => setClaimId(x.id)}>
              <span className="mono">{x.id}</span>
              <span>{x.teaser}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="demo-grid">
        {/* Left: the remittance and the provider's records */}
        <section className="demo-col" aria-label="Remittance and records">
          <div className="panel">
            <div className="row-between">
              <h2 className="h-sm">Remittance</h2>
              <span className="mono muted small">835 · remit {c.remitDate}</span>
            </div>
            <dl className="kv">
              <dt>Member</dt>
              <dd>
                Synthetic {c.member.id}, {c.member.age} {c.member.sex}, {c.member.plan}
              </dd>
              <dt>Provider</dt>
              <dd>
                {c.provider.name}, {c.provider.specialty}
              </dd>
              <dt>Service date</dt>
              <dd>{c.dateOfService}</dd>
              <dt>Claim no.</dt>
              <dd className="mono">{c.payerClaimId}</dd>
            </dl>
            <div className="tablewrap">
              <table className="remit">
                <thead>
                  <tr>
                    <th>Ln</th>
                    <th>Code</th>
                    <th className="num">Billed</th>
                    <th className="num">Paid</th>
                    <th>Denial</th>
                  </tr>
                </thead>
                <tbody>
                  {c.lines.map((l) => {
                    const den = l.paid === 0;
                    const dcodes = [...l.adjustments.filter((a) => a.carc !== "45").map((a) => `${a.group}-${a.carc}`), ...l.remarks];
                    return (
                      <tr key={l.line} className={den ? "denied" : ""}>
                        <td className="mono">{l.line}</td>
                        <td>
                          <span className="mono">
                            {l.code}
                            {l.modifiers.length ? `-${l.modifiers.join("-")}` : ""}
                          </span>
                          {l.units > 1 ? <span className="muted"> ×{l.units}</span> : null}
                          <div className="muted small">{l.description}</div>
                        </td>
                        <td className="num mono">{money(l.billed)}</td>
                        <td className="num mono">{money(l.paid)}</td>
                        <td>
                          {den ? (
                            dcodes.map((k) => (
                              <span key={k} className="pill p-bad code-pill" title={codeMeaning(codes, k)}>
                                {k}
                              </span>
                            ))
                          ) : (
                            <span className="pill p-ok">Paid</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="code-key small muted">
              {[...new Set(denied.flatMap((l) => [...l.adjustments.filter((a) => a.carc !== "45").map((a) => `${a.group}-${a.carc}`), ...l.remarks]))].map((k) => (
                <li key={k}>
                  <b className="mono">{k}</b> {codeMeaning(codes, k)}
                </li>
              ))}
            </ul>
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

        {/* Right: findings and the drafted appeal */}
        <section className="demo-col" aria-label="Assistant findings" aria-live="polite">
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
            <button className="btn" onClick={() => run(claimId, mode)} disabled={running}>
              {running ? "Analyzing…" : "Analyze denials"}
            </button>
            <span className="muted small">
              {liveAvailable ? "Live calls Claude Opus 5.5 twice: analysis, then the letter." : "Replay mode: live calls are off on this deployment."}
            </span>
          </div>

          {error && <div className="callout bad">{error}</div>}
          {!shown && !error && <div className="panel muted">{running ? "Reading the remittance and records…" : "Pick a claim to analyze."}</div>}

          {shown && (
            <>
              {shown.notice && <div className="callout">{shown.notice}</div>}
              <div className={`panel route ${shown.recoverable > 0 ? "route-ok" : "route-bad"}`}>
                <div className="row-between">
                  <span className="eyebrow">Worth pursuing</span>
                  <span className="mono muted small">
                    {shown.findings.filter((f) => f.action !== "no_action").length} of {shown.findings.length} denied lines
                  </span>
                </div>
                <h2>{money(shown.recoverable)} billed at stake</h2>
                <p className="muted">{shown.summary}</p>
              </div>

              <div className="panel">
                <h2 className="h-sm">Denied lines</h2>
                <ol className="crit-list">
                  {shown.findings.map((f) => (
                    <li key={f.line} className="crit">
                      <div className="row-between">
                        <span>
                          <b className="mono">Line {f.line}</b> <span className="mono">{f.code}</span> · {money(f.billed)} ·{" "}
                          <span className="muted">{CATEGORY[f.category]}</span>
                        </span>
                        <span className="pill-row">
                          {f.strength && <span className={`pill ${STRENGTH[f.strength].cls}`}>{STRENGTH[f.strength].label}</span>}
                          <span className={`pill ${ACTION[f.action].cls}`}>{ACTION[f.action].label}</span>
                        </span>
                      </div>
                      <p>{f.explanation}</p>
                      {f.downgraded && (
                        <p className="small warn-text">
                          The model suggested &quot;{ACTION[f.modelAction].label.toLowerCase()}&quot;, but no verified quote from the provider&apos;s records
                          answers the denial, so this was changed to &quot;don&apos;t pursue&quot;.
                        </p>
                      )}
                      {f.evidence.length > 0 && (
                        <ul className="evidence">
                          {f.evidence.map((e, i) => (
                            <li key={i} className={e.verified ? "ev ok" : "ev bad"}>
                              <span className="mono">{e.docId}</span> “{e.quote}”{" "}
                              <span className="small">{e.verified ? (e.fromRecord ? "✓ in record" : "✓ in policy") : "✕ not found"}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="small">
                        <b>Next step:</b> {f.nextSteps}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              {shown.correctedClaim && (
                <div className="panel">
                  <h2 className="h-sm">Corrected claim</h2>
                  <pre className="doc letter">{shown.correctedClaim}</pre>
                </div>
              )}

              {shown.letter && (
                <div className="panel">
                  <div className="row-between">
                    <h2 className="h-sm">Draft appeal letter</h2>
                    <button type="button" className="btn ghost arch-toggle" onClick={() => copyLetter(shown.letter!.text)}>
                      {copied ? "Copied" : "Copy letter"}
                    </button>
                  </div>
                  <pre className="doc letter">{shown.letter.text}</pre>
                  <p className="muted small">
                    {shown.letter.quotesVerified} of {shown.letter.quotes} quoted passages match the records or policy word for word. Review and sign before
                    sending.
                  </p>
                </div>
              )}

              <div className="panel">
                <div className="row-between">
                  <h2 className="h-sm">Run trace</h2>
                  <span className={`pill ${shown.mode === "live" ? "p-ok" : "p-mute"}`}>{shown.mode === "live" ? `Live · ${shown.model}` : shown.replaySource === "live" ? "Replay of a recorded live run" : "Replay · sample output"}
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
                  Redacted before any model call: {shown.redactions.map((r) => `${r.label} ×${r.count}`).join(", ") || "nothing"}.
                  {shown.usage && ` Tokens: ${shown.usage.inputTokens.toLocaleString()} in / ${shown.usage.outputTokens.toLocaleString()} out, about $${shown.usage.estCostUsd.toFixed(3)}.`}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
      <p className="muted small">Synthetic claims and illustrative payment policies. Code meanings are paraphrased from the X12 code lists.</p>
    </div>
  );
}
