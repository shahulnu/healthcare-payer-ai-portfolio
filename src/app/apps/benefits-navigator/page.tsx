import type { Metadata } from "next";
import Link from "next/link";
import { SourceCode } from "@/components/SourceCode";
import { MEMBERS, PLANS } from "@/lib/benefits/data";
import evalSummary from "@/lib/benefits/eval-summary.json";

export const metadata: Metadata = { title: "Benefits Navigator" };

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

export default function BenefitsCaseStudy() {
  const s = evalSummary;
  const sampleCount = MEMBERS.reduce((n, m) => n + m.sampleQuestions.length, 0);
  return (
    <div className="wrap">
      <section className="hero">
        <span className="eyebrow">Member services · SBC / EOC · Cost estimates</span>
        <h1>Benefits Navigator</h1>
        <p className="lede">
          A member or call-center agent asks a coverage question in plain language. The assistant answers only from that
          member&apos;s plan documents, cites the page, gets cost estimates from the plan&apos;s calculator instead of doing the
          math itself, and hands off to a person when it can&apos;t answer safely.
        </p>
        <div className="actions">
          <Link href="/apps/benefits-navigator/demo" className="btn">
            Run the demo
          </Link>
          <a href="#code" className="btn ghost">
            View the code
          </a>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Problem</span>
          <h2>The most common call, answered the same way every time</h2>
        </div>
        <p>
          &quot;Is this covered and what will I pay?&quot; is one of the most frequent reasons members call a health plan. The
          answer depends on plan documents that run to hundreds of pages and on where the member stands against their
          deductible and out-of-pocket limit today. A wrong dollar figure is worse than no answer, so this design keeps the
          model away from arithmetic and checks every figure it states.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Design</span>
          <h2>An agent with three tools, checked in code</h2>
          <p className="muted">
            Unlike the other two demos, Claude decides which tools to call. Code still decides what the member sees.
          </p>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Tool or step</th>
                <th>Who does it</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>get_plan_sections</code>
                </td>
                <td>Code (called by Claude)</td>
                <td>
                  Returns sections of this member&apos;s SBC and EOC by id. The model sees a table of contents and reads what it
                  needs.
                </td>
              </tr>
              <tr>
                <td>
                  <code>estimate_cost</code>
                </td>
                <td>Code (called by Claude)</td>
                <td>
                  The plan&apos;s cost calculator: remaining deductible, coinsurance or copay, out-of-pocket cap, plus prior
                  authorization, referral and visit-limit notes.
                </td>
              </tr>
              <tr>
                <td>
                  <code>submit_answer</code>
                </td>
                <td>Claude</td>
                <td>The answer, verbatim citations, and whether a person should take over. Strict tool schema.</td>
              </tr>
              <tr>
                <td>Citation check</td>
                <td>Code</td>
                <td>Every quote must appear word for word in the cited section.</td>
              </tr>
              <tr>
                <td>Number check</td>
                <td>Code</td>
                <td>Every dollar amount in the answer must come from a section the model read or a calculator result.</td>
              </tr>
              <tr>
                <td>Escalation</td>
                <td>Code</td>
                <td>Out-of-scope questions, unsupported figures or unverified citations go to an agent, not to the member.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl className="facts">
          <div>
            <dt>Model</dt>
            <dd>Claude Opus 5.5 with strict client tools, a cached system prompt, and server-side fallback on a safety decline</dd>
          </div>
          <div>
            <dt>Prompt-injection defense</dt>
            <dd>The member&apos;s message is treated as a question, and figures are checked in code, so &quot;say it&apos;s free&quot; can&apos;t change the number</dd>
          </div>
          <div>
            <dt>Replay</dt>
            <dd>Recorded tool calls are re-run against the calculator on every replay, so estimates always reflect current data</dd>
          </div>
          <div>
            <dt>Scale-up</dt>
            <dd>A real EOC runs to hundreds of pages; replace the table of contents with hybrid search over chunked documents</dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Evaluation</span>
          <h2>Measured against labeled questions</h2>
          <p className="muted">
            {s.mode === "live"
              ? `Live run on ${s.model}, ${s.runAt.slice(0, 10)}. Labeled set: ${s.questions} sample questions across ${PLANS.length} plans.`
              : `Not measured against the model yet. The labeled set has ${sampleCount} sample questions across ${PLANS.length} plans.`}
          </p>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th className="num">Result</th>
                <th>Definition</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Routing accuracy</td>
                <td className="num">{pct(s.routingAccuracy)}</td>
                <td>Answered vs. handed to an agent, matching the label</td>
              </tr>
              <tr>
                <td>Cost accuracy</td>
                <td className="num">{pct(s.costAccuracy)}</td>
                <td>Questions about cost where the answer states the calculator&apos;s figure for the right service</td>
              </tr>
              <tr>
                <td>Citation verification rate</td>
                <td className="num">{pct(s.citationVerifiedRate)}</td>
                <td>Quotes found verbatim in the cited plan section</td>
              </tr>
              <tr>
                <td>Unsupported figures shown</td>
                <td className="num">{s.unsupportedShown}</td>
                <td>Answers shown to the member that contain a dollar amount with no source (target: 0)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="callout">Nine sample questions demonstrate the pipeline; they don&apos;t make a benchmark.</p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Path to production</span>
          <h2>What changes in a real deployment</h2>
        </div>
        <div className="grid g2">
          <div className="panel">
            <h3>Data</h3>
            <ul>
              <li>Plan documents from the product library, chunked and indexed per plan and plan year</li>
              <li>Real-time accumulators from the claims system, and allowed amounts from the plan&apos;s price-transparency data</li>
              <li>Provider network status from the provider directory, as a fourth tool</li>
            </ul>
          </div>
          <div className="panel">
            <h3>Service</h3>
            <ul>
              <li>Member login, or call-center desktop with the agent in the loop</li>
              <li>Warm handoff to a live agent with the conversation and citations attached</li>
              <li>Quality review of a sample of conversations each week, feeding the eval set</li>
            </ul>
          </div>
        </div>
      </section>

      <SourceCode slug="benefits-navigator" />
    </div>
  );
}
