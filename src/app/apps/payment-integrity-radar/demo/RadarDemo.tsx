"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lead, PiBrief, Screen, Tier } from "@/lib/pi/types";
import { RiskScatter, StripPlot } from "./PeerCharts";

type Result = PiBrief & { notice?: string };

const TIER: Record<Tier, { label: string; cls: string }> = {
  high: { label: "High", cls: "p-bad" },
  medium: { label: "Medium", cls: "p-warn" },
  none: { label: "No lead", cls: "p-mute" },
};

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function RadarDemo({ screen, initialLeadId }: { screen: Screen; initialLeadId: string }) {
  const [leadId, setLeadId] = useState(initialLeadId);
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const lead: Lead = screen.leads.find((l) => l.providerId === leadId)!;
  const peers = screen.peers[lead.specialty];
  const totalExposure = screen.leads.reduce((a, l) => a + l.exposure, 0);

  const run = useCallback(async (id: string, m: "replay" | "live") => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/pi/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: id, mode: m }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(data.error ?? `Request failed (${res.status}).`);
      } else {
        setResult(data);
      }
    } catch {
      setError("Couldn't reach the brief service. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/pi/brief")
      .then((r) => r.json())
      .then((d) => setLiveAvailable(Boolean(d.liveAvailable)))
      .catch(() => setLiveAvailable(false));
  }, []);

  // Open in a working state: replay the selected lead's brief as soon as it is picked.
  useEffect(() => {
    setResult(null);
    run(leadId, "replay");
  }, [leadId, run]);

  const shown = result && result.providerId === leadId ? result : null;
  const cited = new Set(shown?.brief.cited_fact_ids ?? []);

  return (
    <div className="wrap demo-page text-full">
      <section className="demo-head">
        <div>
          <span className="eyebrow">Payment Integrity Radar · demo</span>
          <h1 className="demo-title">Lead queue · {screen.period}</h1>
        </div>
        <div className="stats">
          <span>
            <b>{screen.cohortSize}</b>synthetic providers screened
          </span>
          <span>
            <b>{screen.leads.length}</b>leads
          </span>
          <span>
            <b>{screen.cleared.length}</b>cleared by risk adjustment
          </span>
          <span>
            <b>{money(totalExposure)}</b>estimated billing above peer pattern
          </span>
        </div>
      </section>

      <div className="demo-grid radar-grid">
        {/* Left: the queue the statistics produced, before any model runs */}
        <section className="demo-col" aria-label="Lead queue">
          <div className="panel">
            <h2 className="h-sm">Ranked by the screen</h2>
            <div className="lead-list">
              {screen.leads.map((l) => (
                <button key={l.providerId} type="button" className={l.providerId === leadId ? "lead-row on" : "lead-row"} aria-pressed={l.providerId === leadId} onClick={() => setLeadId(l.providerId)}>
                  <span className="row-between">
                    <span className="mono">{l.providerId}</span>
                    <span className={`pill ${TIER[l.tier].cls}`}>
                      {TIER[l.tier].label} · {l.score}
                    </span>
                  </span>
                  <span className="muted small">{l.specialty}</span>
                  <span className="small">{l.flaggedLabels.join("; ")}</span>
                </button>
              ))}
            </div>
          </div>
          {screen.cleared.map((c) => {
            const f = c.features.find((x) => x.expected !== null)!;
            return (
              <div className="panel" key={c.providerId}>
                <span className="eyebrow">Not a lead</span>
                <h2 className="h-sm mono">{c.providerId}</h2>
                <p className="small">
                  {f.label}: {f.display}, a raw outlier against peers (z {f.rawZ}). This panel&apos;s patients are much sicker, and the expected share for that risk
                  is {f.expectedDisplay} (adjusted z {f.z}). No lead was opened, and no model was called.
                </p>
              </div>
            );
          })}
          <p className="muted small">Detection is statistics only. Scores and tiers are set in code, before Claude sees anything.</p>
        </section>

        {/* Right: the selected lead */}
        <section className="demo-col" aria-label="Selected lead">
          <div className="panel">
            <div className="row-between">
              <h2 className="h-sm">
                <span className="mono">{lead.providerId}</span> against {peers[Object.keys(peers)[0]].length} {lead.specialty} peers
              </h2>
              <span className={`pill ${TIER[lead.tier].cls}`}>{TIER[lead.tier].label} tier</span>
            </div>
            <div className="chart-legend small muted">
              <span>
                <i className="key key-focus" /> This provider
              </span>
              <span>
                <i className="key key-peer" /> Peers
              </span>
              <span>
                <i className="key key-median" /> Peer median
              </span>
            </div>
            <div className="feature-list">
              {lead.features.map((f) => (
                <div className="feature" key={f.id}>
                  <div className="row-between small">
                    <b>{f.label}</b>
                    <span className="feature-meta">
                      <span className="muted">
                        median {f.peerDisplay}
                        {f.expectedDisplay ? ` · expected ${f.expectedDisplay}` : ""} · z {f.z.toFixed(1)}
                      </span>
                      {f.flagged && <span className="pill p-bad">⚑ {f.hardRule ? "Above 16 hours" : "Flagged"}</span>}
                    </span>
                  </div>
                  <StripPlot feature={f} points={peers[f.id]} providerId={lead.providerId} />
                </div>
              ))}
            </div>
            {lead.exposure > 0 && (
              <p className="small">
                <b>{money(lead.exposure)}</b> estimated billing above the peer pattern. This sizes the lead and is not an overpayment finding.
              </p>
            )}
          </div>

          {peers.level5_share && (
            <div className="panel">
              <h2 className="h-sm">99215 share against patient risk</h2>
              <p className="muted small">The line is the share expected for a panel&apos;s risk. Distance above the line is what gets scored, not the raw share.</p>
              <RiskScatter points={peers.level5_share} providerId={lead.providerId} clearedIds={screen.cleared.map((c) => c.providerId)} line={screen.level5Line} />
            </div>
          )}

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
            <button className="btn" onClick={() => run(leadId, mode)} disabled={running}>
              {running ? "Writing…" : "Write lead brief"}
            </button>
            <span className="muted small">{liveAvailable ? "Live calls Claude Opus 5.5 (about 15–25 s)." : "Replay mode: live calls are off on this deployment."}</span>
          </div>

          {error && <div className="callout bad">{error}</div>}
          {!shown && !error && <div className="panel muted">{running ? "Writing the brief from the screen results…" : "Pick a lead."}</div>}

          {shown && (
            <>
              {shown.notice && <div className="callout">{shown.notice}</div>}
              <div className={`panel route ${shown.status === "ready" ? "route-ok" : "route-warn"}`}>
                <div className="row-between">
                  <span className="eyebrow">Lead brief for the analyst</span>
                  <span className={`pill ${shown.status === "ready" ? "p-ok" : "p-warn"}`}>{shown.status === "ready" ? "✓ Passed checks" : "⚠ Held for analyst edit"}</span>
                </div>
                <h2>{shown.brief.headline}</h2>
                <p>{shown.brief.pattern}</p>
                {shown.holdReasons.length > 0 && (
                  <ul className="small warn-text">
                    {shown.holdReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                <p className="small">
                  <b>Action set by the screen:</b> {shown.action}. Any payment decision stays with people, after a records review.
                </p>
              </div>

              <div className="panel">
                <h2 className="h-sm">Legitimate explanations to rule out</h2>
                <ul className="tight-list">
                  {shown.brief.alternative_explanations.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <h2 className="h-sm">Next steps</h2>
                <ul className="tight-list">
                  {shown.brief.next_steps.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>

              <div className="panel">
                <div className="row-between">
                  <h2 className="h-sm">Checks and run trace</h2>
                  <span className={`pill ${shown.mode === "live" ? "p-ok" : "p-mute"}`}>
                    {shown.mode === "live" ? `Live · ${shown.model}` : shown.replaySource === "live" ? "Replay of a recorded live run" : "Replay · sample output"}
                    {shown.engine === "java" ? " · Java engine" : ""}
                  </span>
                </div>
                <ul className="tight-list small">
                  <li>
                    {shown.numberCheck.found.length} figures in the brief, {shown.numberCheck.unsupported.length} not found in the screen results
                  </li>
                  <li>{shown.languageCheck.flagged.length} words implying wrongdoing</li>
                  <li>
                    {shown.citationCheck.cited.length} facts cited, {shown.citationCheck.citesFlagged ? "including a flagged pattern" : "none flagged"}
                  </li>
                </ul>
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
                {shown.usage && (
                  <p className="muted small">
                    Tokens: {shown.usage.inputTokens.toLocaleString()} in / {shown.usage.outputTokens.toLocaleString()} out, about ${shown.usage.estCostUsd.toFixed(3)}.
                  </p>
                )}
                <details className="tool-log">
                  <summary>The {shown.facts.length} facts Claude was given (aggregates only, no member data)</summary>
                  <ul className="evidence">
                    {shown.facts.map((f) => (
                      <li key={f.id} className={cited.has(f.id) ? "ev ok" : "ev"}>
                        <span className="mono">{f.id}</span> {f.text}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </>
          )}
        </section>
      </div>
      <p className="muted small">
        Synthetic providers generated for this demo, with injected patterns. Illustrative unit values. A statistical outlier is a reason to look, not a finding about anyone.
      </p>
    </div>
  );
}
