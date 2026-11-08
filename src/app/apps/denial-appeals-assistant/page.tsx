import type { Metadata } from "next";
import Link from "next/link";
import { SourceCode } from "@/components/SourceCode";
import { CLAIMS } from "@/lib/appeals/claims";
import evalSummary from "@/lib/appeals/eval-summary.json";

export const metadata: Metadata = { title: "Denial & Appeals Assistant" };

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

export default function AppealsCaseStudy() {
  const s = evalSummary;
  return (
    <div className="wrap">
      <section className="hero">
        <span className="eyebrow">Claims · X12 835 · CARC / RARC</span>
        <h1>Denial &amp; Appeals Assistant</h1>
        <p className="lede">
          Reads a remittance and the provider&apos;s records, explains each denied line in plain English, decides whether it is
          worth an appeal, a corrected claim or nothing, and drafts the appeal letter from evidence it has verified.
        </p>
        <div className="actions">
          <Link href="/apps/denial-appeals-assistant/demo" className="btn">
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
          <h2>Rework on both sides of every denial</h2>
        </div>
        <p>
          A denied claim costs the provider staff time to understand and the payer staff time to process again on appeal.
          Many denials are fixable: a missing modifier, a record that was never sent, a filing date the payer lost track of.
          Others aren&apos;t worth pursuing. The hard part is telling them apart quickly and sending the right evidence the
          first time. The same assistant works for a provider&apos;s billing team or a health plan&apos;s provider-services
          desk.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Design</span>
          <h2>Two model calls, with code checks between them</h2>
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
                <td>1. Remittance parsing</td>
                <td>Code</td>
                <td>Denied lines, group codes and CARC/RARC meanings come from lookup tables, not from the model.</td>
              </tr>
              <tr>
                <td>2. Identifier redaction</td>
                <td>Code</td>
                <td>Names, dates of birth, MRNs, account numbers and phone numbers are removed first.</td>
              </tr>
              <tr>
                <td>3. Denial analysis</td>
                <td>Claude Opus 5.5</td>
                <td>Per denied line: plain-English reason, category, suggested action and verbatim evidence.</td>
              </tr>
              <tr>
                <td>4. Evidence check</td>
                <td>Code</td>
                <td>
                  A line is pursued only if verified quotes from the provider&apos;s own records answer the denial. Strength is
                  scored from how many.
                </td>
              </tr>
              <tr>
                <td>5. Appeal letter</td>
                <td>Claude Opus 5.5</td>
                <td>Drafted only for lines that passed step 4, and only from their verified quotes.</td>
              </tr>
              <tr>
                <td>6. Letter check</td>
                <td>Code</td>
                <td>Every quoted passage in the letter is matched against the records and policy before a person signs it.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted">
          Corrected-claim instructions are assembled in code (replacement claim, frequency code 7, original claim number), so
          the model only supplies the fix for each line.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Evaluation</span>
          <h2>Measured against labeled lines</h2>
          <p className="muted">
            {s.mode === "live"
              ? `Live run on ${s.model}, ${s.runAt.slice(0, 10)}. Labeled set: ${s.claims} synthetic claims, ${s.lines} denied lines.`
              : "Not measured against the model yet. The labeled set has 3 synthetic claims with 5 denied lines."}
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
                <td>Action accuracy</td>
                <td className="num">{pct(s.actionAccuracy)}</td>
                <td>Final recommendation (appeal, corrected claim, don&apos;t pursue) matches the label</td>
              </tr>
              <tr>
                <td>Category accuracy</td>
                <td className="num">{pct(s.categoryAccuracy)}</td>
                <td>Denial category matches the label</td>
              </tr>
              <tr>
                <td>Citation verification rate</td>
                <td className="num">{pct(s.citationVerifiedRate)}</td>
                <td>Quotes found verbatim in the cited record or policy</td>
              </tr>
              <tr>
                <td>Unsupported appeals</td>
                <td className="num">{s.unsupportedAppeals}</td>
                <td>Lines recommended for appeal or correction that the label says not to pursue (target: 0)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="callout">Five labeled lines demonstrate the pipeline; they don&apos;t make a benchmark.</p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Demo claims</span>
          <h2>Three synthetic denials</h2>
        </div>
        <div className="grid g3">
          {CLAIMS.map((c) => (
            <Link key={c.id} href={`/apps/denial-appeals-assistant/demo?claim=${c.id}`} className="panel app-card">
              <span className="eyebrow">{c.id}</span>
              <h3>{c.teaser}</h3>
              <p className="muted">
                {c.provider.specialty} · {c.lines.filter((l) => l.paid === 0).length} denied lines
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Path to production</span>
          <h2>What changes in a real deployment</h2>
        </div>
        <div className="grid g2">
          <div className="panel">
            <h3>Integration</h3>
            <ul>
              <li>Read 835 remittances and 277CA acknowledgments from the clearinghouse feed</li>
              <li>Pull records from the EHR document store; full CARC/RARC tables, updated with each X12 release</li>
              <li>Submit corrected claims as 837 replacements and appeals through the payer portal or API</li>
            </ul>
          </div>
          <div className="panel">
            <h3>Learning loop</h3>
            <ul>
              <li>Record appeal outcomes and train an overturn model to replace the rule-based strength score</li>
              <li>Report denial trends by code and payer so front-end billing fixes the root cause</li>
              <li>Human sign-off on every letter, with an audit trail of what was sent</li>
            </ul>
          </div>
        </div>
      </section>

      <SourceCode slug="denial-appeals-assistant" />
    </div>
  );
}
