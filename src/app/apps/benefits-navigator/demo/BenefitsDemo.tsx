"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { BenefitsAnswer, Member, Plan } from "@/lib/benefits/types";

type Result = BenefitsAnswer & { notice?: string };
type Turn = { id: number; question: string; result?: Result; error?: string };

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

export function BenefitsDemo({ members, plans, initialMemberId }: { members: Member[]; plans: Plan[]; initialMemberId: string }) {
  const [memberId, setMemberId] = useState(initialMemberId);
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [threads, setThreads] = useState<Record<string, Turn[]>>({});
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const nextId = useRef(1);

  const member = members.find((m) => m.id === memberId)!;
  const plan = plans.find((p) => p.id === member.planId)!;
  const thread = threads[memberId] ?? [];
  const latest = [...thread].reverse().find((t) => t.result)?.result;

  const ask = useCallback(
    async (payload: { questionId?: string; question?: string }, text: string, m: "replay" | "live", forMember: string) => {
      const id = nextId.current++;
      setThreads((t) => ({ ...t, [forMember]: [...(t[forMember] ?? []), { id, question: text }] }));
      setRunning(true);
      const settle = (patch: Partial<Turn>) =>
        setThreads((t) => ({ ...t, [forMember]: (t[forMember] ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      try {
        const res = await fetch("/api/benefits/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId: forMember, ...payload, mode: m }),
        });
        const data = await res.json();
        if (!res.ok) settle({ error: data.error ?? `Request failed (${res.status}).` });
        else settle({ result: data });
      } catch {
        settle({ error: "Couldn't reach the assistant. Check your connection and try again." });
      } finally {
        setRunning(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetch("/api/benefits/ask")
      .then((r) => r.json())
      .then((d) => setLiveAvailable(Boolean(d.liveAvailable)))
      .catch(() => setLiveAvailable(false));
  }, []);

  // Open in a working state: replay the first sample question for each member the first time it's shown.
  const started = useRef(new Set<string>());
  useEffect(() => {
    if (started.current.has(memberId)) return;
    started.current.add(memberId);
    const q = member.sampleQuestions[0];
    ask({ questionId: q.id }, q.text, "replay", memberId);
  }, [memberId, member, ask]);

  function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || running) return;
    setDraft("");
    ask({ question: text }, text, "live", memberId);
  }

  const cited = new Map<string, string[]>();
  latest?.citations.filter((c) => c.verified).forEach((c) => cited.set(c.sectionId, [...(cited.get(c.sectionId) ?? []), c.quote]));
  const acc = member.accumulators;

  return (
    <div className="wrap demo-page">
      <section className="demo-head">
        <div>
          <span className="eyebrow">Benefits Navigator · demo</span>
          <h1 className="demo-title">Ask about your coverage</h1>
        </div>
        <div className="case-tabs" role="tablist" aria-label="Synthetic members">
          {members.map((m) => {
            const p = plans.find((x) => x.id === m.planId)!;
            return (
              <button key={m.id} role="tab" aria-selected={m.id === memberId} className={m.id === memberId ? "case-tab on" : "case-tab"} onClick={() => setMemberId(m.id)}>
                <span className="mono">{m.id}</span>
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="demo-grid">
        {/* Left: the member's plan and documents */}
        <section className="demo-col" aria-label="Member plan and documents">
          <div className="panel">
            <div className="row-between">
              <h2 className="h-sm">{plan.name}</h2>
              <span className="pill p-acc">{plan.type}</span>
            </div>
            <dl className="kv">
              <dt>Member</dt>
              <dd>{member.label}</dd>
              <dt>Deductible</dt>
              <dd>
                {money(acc.deductibleMet.in)} of {money(plan.limits.deductible.in)} met (in-network)
              </dd>
              <dt>Out-of-pocket</dt>
              <dd>
                {money(acc.oopMet.in)} of {money(plan.limits.oopMax.in)} met
              </dd>
              <dt>As of</dt>
              <dd>{member.accumulatorsAsOf}</dd>
            </dl>
          </div>
          <div className="panel">
            <h2 className="h-sm">Plan documents</h2>
            <p className="muted small">Sections the latest answer cited are highlighted.</p>
            <div className="sections">
              {plan.sections.map((s) => (
                <div key={s.id} className={cited.has(s.id) ? "section-doc on" : "section-doc"}>
                  <div className="row-between">
                    <b>{s.title}</b>
                    <span className="mono muted small">
                      {s.doc} p.{s.page} · {s.id}
                    </span>
                  </div>
                  <p className="small">
                    <Highlighted text={s.text} quotes={cited.get(s.id) ?? []} />
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right: the conversation */}
        <section className="demo-col" aria-label="Conversation" aria-live="polite">
          <div className="panel run-bar">
            <div className="seg" role="radiogroup" aria-label="Mode for sample questions">
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
            <span className="muted small">
              {liveAvailable ? "Sample questions run in the mode you pick. Your own questions always run live." : "Replay mode: pick a sample question."}
            </span>
          </div>

          <div className="panel">
            <h2 className="h-sm">Sample questions</h2>
            <div className="chips">
              {member.sampleQuestions.map((q) => (
                <button key={q.id} type="button" className="chip" disabled={running} onClick={() => ask({ questionId: q.id }, q.text, mode, memberId)}>
                  {q.text}
                </button>
              ))}
            </div>
          </div>

          <div className="chat-thread">
            {thread.map((t) => (
              <Fragment key={t.id}>
                <div className="bubble me">{t.question}</div>
                {!t.result && !t.error && <div className="bubble ai muted">Reading your plan documents…</div>}
                {t.error && <div className="callout bad">{t.error}</div>}
                {t.result && <AnswerCard r={t.result} />}
              </Fragment>
            ))}
          </div>

          <form className="ask-form" onSubmit={submitDraft}>
            <label htmlFor="benefits-question" className="sr-only">
              Your question
            </label>
            <input
              id="benefits-question"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              placeholder={liveAvailable ? "Ask your own question (runs live)…" : "Your own questions need Live mode"}
              disabled={!liveAvailable || running}
            />
            <button className="btn" type="submit" disabled={!liveAvailable || running || !draft.trim()}>
              Ask
            </button>
          </form>
        </section>
      </div>
      <p className="muted small">Fictional plans and members. Estimates use illustrative allowed amounts. Not a guarantee of payment.</p>
    </div>
  );
}

function AnswerCard({ r }: { r: Result }) {
  const escalated = r.status === "escalated";
  return (
    <div className={`bubble ai answer ${escalated ? "escalated" : ""}`}>
      {r.notice && <p className="small warn-text">{r.notice}</p>}
      <div className="row-between">
        <span className={`pill ${escalated ? "p-warn" : "p-ok"}`}>{escalated ? "Handed to an agent" : "Answered from your plan"}</span>
        <span className={`pill ${r.mode === "live" ? "p-ok" : "p-mute"}`}>
          {r.mode === "live" ? `Live · ${r.model}` : r.replaySource === "live" ? "Replay of a recorded live run" : "Replay · sample"}
          {r.engine === "java" ? " · Java engine" : ""}
        </span>
      </div>
      <p className="answer-text">{r.answer}</p>
      {escalated && r.escalationReason && (
        <p className="small">
          <b>Why an agent:</b> {r.escalationReason}
        </p>
      )}

      {r.estimates.map((e, i) => (
        <div key={i} className="cost-card">
          <div className="row-between">
            <b>
              {e.serviceName} · {e.network === "in" ? "in-network" : "out-of-network"}
            </b>
            <span className="cost-total">{e.covered ? money(e.memberPays) : "Not covered"}</span>
          </div>
          {e.covered && (
            <table className="mini">
              <tbody>
                <tr>
                  <td>Allowed amount</td>
                  <td className="num">{money(e.allowedAmount)}</td>
                </tr>
                {e.deductiblePortion > 0 && (
                  <tr>
                    <td>Toward your deductible</td>
                    <td className="num">{money(e.deductiblePortion)}</td>
                  </tr>
                )}
                {e.coinsurancePortion > 0 && (
                  <tr>
                    <td>Coinsurance</td>
                    <td className="num">{money(e.coinsurancePortion)}</td>
                  </tr>
                )}
                {e.copay > 0 && (
                  <tr>
                    <td>Copay</td>
                    <td className="num">{money(e.copay)}</td>
                  </tr>
                )}
                <tr>
                  <td>Plan pays</td>
                  <td className="num">{money(e.planPays)}</td>
                </tr>
              </tbody>
            </table>
          )}
          {e.notes.length > 0 && <p className="muted small">{e.notes.join(" ")}</p>}
          <p className="muted small">From the plan&apos;s cost calculator, not the model.</p>
        </div>
      ))}

      {r.citations.length > 0 && (
        <ul className="evidence">
          {r.citations.map((c, i) => (
            <li key={i} className={c.verified ? "ev ok" : "ev bad"}>
              <span className="mono">
                {c.doc} p.{c.page ?? "?"}
              </span>{" "}
              “{c.quote}” <span className="small">{c.verified ? "✓ in plan" : "✕ not found"}</span>
            </li>
          ))}
        </ul>
      )}

      <details className="tool-log">
        <summary>
          How this was answered: {r.toolCalls.length} tool calls · {r.numberCheck.found.length} dollar amounts checked
          {r.numberCheck.unsupported.length ? `, ${r.numberCheck.unsupported.length} unsupported` : ""}
        </summary>
        <ol>
          {r.toolCalls.map((t, i) => (
            <li key={i}>
              <span className="mono">{t.name}</span> <span className="mono muted small">{JSON.stringify(t.input)}</span>
            </li>
          ))}
        </ol>
        <div className="tablewrap">
          <table>
            <tbody>
              {r.trace.map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td className="muted">{t.detail}</td>
                  <td className="num mono">{t.ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.usage && (
          <p className="muted small">
            Tokens: {r.usage.inputTokens.toLocaleString()} in / {r.usage.outputTokens.toLocaleString()} out, about ${r.usage.estCostUsd.toFixed(3)}.
          </p>
        )}
      </details>
    </div>
  );
}
