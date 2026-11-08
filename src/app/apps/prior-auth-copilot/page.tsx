import type { Metadata } from "next";
import Link from "next/link";
import { CASES } from "@/lib/pa/cases";
import evalSummary from "@/lib/pa/eval-summary.json";

export const metadata: Metadata = { title: "Prior Auth Copilot" };

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

export default function PriorAuthCaseStudy() {
  const s = evalSummary;
  return (
    <div className="wrap">
      <section className="hero">
        <span className="eyebrow">Utilization management · X12 278 / FHIR Da Vinci PAS</span>
        <h1>Prior Auth Copilot</h1>
        <p className="lede">
          Reads a prior authorization request and its clinical records, checks them against the coverage policy one criterion
          at a time, and gives the nurse reviewer a recommendation in which every finding links to a sentence in the record.
        </p>
        <div className="actions">
          <Link href="/apps/prior-auth-copilot/demo" className="btn">
            Run the demo
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Problem</span>
          <h2>Faster reviews under tighter deadlines</h2>
        </div>
        <p>
          Under the CMS Interoperability and Prior Authorization final rule (CMS-0057-F), impacted payers must decide
          expedited requests within 72 hours and standard requests within 7 calendar days, starting in 2026. Most of a
          nurse&apos;s review time goes to reading notes and matching them to policy criteria. That step is well suited to a
          language model, provided its output can be checked and the decision stays with a clinician.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Design</span>
          <h2>A fixed workflow, not an open-ended agent</h2>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>Who does it</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1. Policy lookup</td>
                <td>Code</td>
                <td>The service code determines the policy. Retrieval is deterministic, so the wrong policy can&apos;t be picked.</td>
              </tr>
              <tr>
                <td>2. Identifier redaction</td>
                <td>Code</td>
                <td>Names, dates of birth, MRNs and phone numbers are removed before any text leaves the plan&apos;s boundary.</td>
              </tr>
              <tr>
                <td>3. Criteria evaluation</td>
                <td>Claude Opus 5.5</td>
                <td>For each criterion: met, not met or insufficient, with verbatim quotes. Output is constrained to a JSON schema.</td>
              </tr>
              <tr>
                <td>4. Citation check</td>
                <td>Code</td>
                <td>Each quote must appear word for word in the cited document. A finding with no verifiable quote is downgraded to &quot;insufficient&quot;.</td>
              </tr>
              <tr>
                <td>5. Routing</td>
                <td>Code</td>
                <td>All met → recommend approval. Anything missing → request info. Anything not met → nurse review. The copilot never recommends denial.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl className="facts">
          <div>
            <dt>Model</dt>
            <dd>Claude Opus 5.5, medium effort, structured output, server-side fallback on a safety decline</dd>
          </div>
          <div>
            <dt>Cost control</dt>
            <dd>System prompt cached; per-visitor daily cap; replay mode when no key is set</dd>
          </div>
          <div>
            <dt>Prompt-injection defense</dt>
            <dd>Records are wrapped as data, and nothing the model writes can change routing</dd>
          </div>
          <div>
            <dt>Deadline tracking</dt>
            <dd>Due time computed from receipt: 72 hours expedited, 7 days standard</dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Evaluation</span>
          <h2>Measured against labeled cases</h2>
          <p className="muted">
            {s.mode === "live"
              ? `Live run on ${s.model}, ${s.runAt.slice(0, 10)}.`
              : "These numbers come from replaying the sample outputs, not a live model run. Run npm run eval -- --live to measure the model."}{" "}
            Labeled set: {s.cases} synthetic cases, {s.criteria} criteria.
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
                <td>Criterion accuracy</td>
                <td className="num">{pct(s.criterionAccuracy)}</td>
                <td>Final status (after the citation check) matches the reviewer label</td>
              </tr>
              <tr>
                <td>Routing accuracy</td>
                <td className="num">{pct(s.routeAccuracy)}</td>
                <td>Case routed to the same queue the reviewer chose</td>
              </tr>
              <tr>
                <td>Citation verification rate</td>
                <td className="num">{pct(s.citationVerifiedRate)}</td>
                <td>Quotes found verbatim in the cited document</td>
              </tr>
              <tr>
                <td>Unsafe approvals</td>
                <td className="num">{s.unsafeApprovals}</td>
                <td>Cases recommended for approval that the reviewer would not approve (target: 0)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="callout">
          Three cases demonstrate the pipeline; they don&apos;t make a benchmark. The next step is a labeled set of 150 to 300
          synthetic cases across 10 policies, with a nurse reviewer providing the labels.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Demo cases</span>
          <h2>Three synthetic requests</h2>
        </div>
        <div className="grid g3">
          {CASES.map((c) => (
            <Link key={c.id} href={`/apps/prior-auth-copilot/demo?case=${c.id}`} className="panel app-card">
              <span className="eyebrow">{c.id}</span>
              <h3>{c.service.description}</h3>
              <p className="muted">{c.teaser}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Path to production</span>
          <h2>What changes at a real health plan</h2>
        </div>
        <div className="grid g2">
          <div className="panel">
            <h3>Integration</h3>
            <ul>
              <li>Intake from the UM platform via X12 278 or FHIR Da Vinci PAS</li>
              <li>Policies loaded from the plan&apos;s medical policy library, versioned and effective-dated</li>
              <li>Hybrid search over policies when the service code alone doesn&apos;t identify one</li>
            </ul>
          </div>
          <div className="panel">
            <h3>Governance</h3>
            <ul>
              <li>Claude through Amazon Bedrock under the plan&apos;s AWS BAA, or the Claude API with a BAA</li>
              <li>Audit log of inputs, outputs, reviewer action and policy version per case</li>
              <li>Model risk review, drift monitoring, and periodic re-labeling of a sample</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
