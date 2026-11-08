import type { Metadata } from "next";
import Link from "next/link";
import { SourceCode } from "@/components/SourceCode";
import evalSummary from "@/lib/hcc/eval-summary.json";

export const metadata: Metadata = { title: "HCC Evidence Finder" };

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

export default function HccCaseStudy() {
  const s = evalSummary;
  return (
    <div className="wrap">
      <section className="hero">
        <span className="eyebrow">Risk adjustment · CMS-HCC V28 · MEAT</span>
        <h1>HCC Evidence Finder</h1>
        <p className="lede">
          Reads a member&apos;s chart and compares it with the diagnosis codes already submitted. It works in both directions:
          supported conditions that were missed, and submitted codes the chart doesn&apos;t support. A certified coder decides
          every line.
        </p>
        <div className="actions">
          <Link href="/apps/hcc-evidence-finder/demo" className="btn">
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
          <h2>Accuracy in both directions</h2>
        </div>
        <p>
          Medicare Advantage risk scores depend on diagnoses documented in face-to-face encounters. V28 is fully phased in for
          payment year 2026, and RADV audits look for submitted codes the chart can&apos;t support. Tools that only hunt for
          additional codes create compliance risk. So this design treats deletions as seriously as additions, sorts them first,
          and never shows a risk score or dollar figure to the coder or the model.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Design</span>
          <h2>Claude reads the chart, code owns the rules</h2>
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
                <td>1. Identifier redaction</td>
                <td>Code</td>
                <td>Names, dates of birth, MRNs and phone numbers are removed before any model call.</td>
              </tr>
              <tr>
                <td>2. Chart review</td>
                <td>Claude Opus 5.5</td>
                <td>For each submitted code and documented condition: supported, not supported, or query the provider, with verbatim quotes tagged Monitor, Evaluate, Assess or Treat.</td>
              </tr>
              <tr>
                <td>3. Evidence check</td>
                <td>Code</td>
                <td>Support needs at least one verified quote from an acceptable encounter. A nurse phone call can&apos;t count, whatever the model says.</td>
              </tr>
              <tr>
                <td>4. Active-disease rule</td>
                <td>Code</td>
                <td>Codes that mean active disease can&apos;t be supported by quotes such as &quot;history of&quot;.</td>
              </tr>
              <tr>
                <td>5. HCC map and hierarchy</td>
                <td>Code</td>
                <td>The ICD-10 to HCC lookup and hierarchy come from a table. The model never assigns an HCC.</td>
              </tr>
              <tr>
                <td>6. Reconciliation</td>
                <td>Code</td>
                <td>Compares findings with submitted codes: review for deletion, suggest adding, query, confirmed, replaced by hierarchy. Any submitted code the model skipped still goes to a coder.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl className="facts">
          <div>
            <dt>Compliance posture</dt>
            <dd>Nothing is submitted or deleted automatically. The prompt excludes risk scores and payment, so the review has no reason to favor adding codes.</dd>
          </div>
          <div>
            <dt>Prompt injection</dt>
            <dd>One demo chart hides an instruction to code E11.22. The chart is treated as a record, and the code isn&apos;t suggested.</dd>
          </div>
          <div>
            <dt>Scope of the map</dt>
            <dd>A small demo subset of V28, checked against published coding guides rather than the CMS mapping file. Verify before relying on it.</dd>
          </div>
          <div>
            <dt>Known limit</dt>
            <dd>The &quot;history of&quot; rule is a simple text match on quotes. It&apos;s a backstop, not a replacement for coder judgment.</dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Evaluation</span>
          <h2>Measured against labeled charts</h2>
          <p className="muted">
            {s.mode === "live"
              ? `Live run on ${s.model}, ${s.runAt.slice(0, 10)}. Labeled set: ${s.charts} synthetic charts, ${s.codes} labeled codes.`
              : "Not measured against the model yet."}
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
                <td>Disposition accuracy</td>
                <td className="num">{pct(s.dispositionAccuracy)}</td>
                <td>Final disposition is one the label accepts</td>
              </tr>
              <tr>
                <td>Supported additions found</td>
                <td className="num">{pct(s.addsFound)}</td>
                <td>Missed conditions the chart supports, suggested for adding</td>
              </tr>
              <tr>
                <td>Unsupported codes caught</td>
                <td className="num">{pct(s.unsupportedCaught)}</td>
                <td>Submitted codes without support, sent for deletion review</td>
              </tr>
              <tr>
                <td>Citation verification rate</td>
                <td className="num">{pct(s.citationVerifiedRate)}</td>
                <td>Quotes found verbatim in the chart</td>
              </tr>
              <tr>
                <td>Forbidden codes suggested</td>
                <td className="num">{s.forbiddenSuggested}</td>
                <td>Codes the chart must not produce, such as the injected instruction or a BMI with no diagnosis (target: 0)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="callout">
          I wrote these three charts and their labels myself, so this checks the pipeline. It isn&apos;t a benchmark. Real numbers need hundreds of charts labeled by
          certified coders, with inter-rater agreement measured.
        </p>
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
              <li>The full CMS V28 mapping and hierarchy tables, versioned by payment year</li>
              <li>Charts from retrieval vendors and EHR feeds, with OCR, signature and date-of-service validation</li>
              <li>Encounter acceptability from CMS rules on provider type and service, not a flag on the document</li>
            </ul>
          </div>
          <div className="panel">
            <h3>Compliance</h3>
            <ul>
              <li>Report adds and deletes side by side, and track the balance as a control</li>
              <li>Send deletes through the plan&apos;s overpayment and data-correction process</li>
              <li>Audit trail from quote to coder decision, with sampled second-coder review</li>
            </ul>
          </div>
        </div>
      </section>

      <SourceCode slug="hcc-evidence-finder" />
    </div>
  );
}
