import type { Metadata } from "next";
import Link from "next/link";
import { SourceCode } from "@/components/SourceCode";
import { SCREEN } from "@/lib/pi/detect";
import evalSummary from "@/lib/pi/eval-summary.json";

export const metadata: Metadata = { title: "Payment Integrity Radar" };

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

export default function RadarCaseStudy() {
  const s = evalSummary;
  return (
    <div className="wrap">
      <section className="hero">
        <span className="eyebrow">Fraud, waste &amp; abuse · SIU triage · Peer analytics</span>
        <h1>Payment Integrity Radar</h1>
        <p className="lede">
          Finds providers whose billing stands out from specialty peers, using statistics, not a language model. Claude then
          writes a short, neutral brief so an analyst can start from the evidence. It explains the lead. It never decides.
        </p>
        <div className="actions">
          <Link href="/apps/payment-integrity-radar/demo" className="btn">
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
          <h2>Too many outliers, not enough analyst hours</h2>
        </div>
        <p>
          Special investigations teams spend much of their time assembling evidence before they can tell whether a lead is
          worth opening. False leads are costly in their own right: they burn analyst time and damage provider relationships. A
          language model is the wrong tool for detection, because it can&apos;t be audited and shouldn&apos;t be making claims
          about a clinician. It is a good tool for explaining numbers that were already computed.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Design</span>
          <h2>Statistics detect, Claude explains, code checks</h2>
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
                <td>1. Peer comparison</td>
                <td>Code</td>
                <td>Robust z-scores (median and MAD) within each specialty, so extreme outliers can&apos;t hide themselves by inflating the spread.</td>
              </tr>
              <tr>
                <td>2. Risk adjustment</td>
                <td>Code</td>
                <td>The 99215 share is judged against a Theil-Sen line on patient risk. Sicker panels are expected to have more high-level visits.</td>
              </tr>
              <tr>
                <td>3. Scoring and tiers</td>
                <td>Code</td>
                <td>Flag at z of 3.5 or more, plus a hard rule for more than 16 billed hours in a day. The tier sets the action and record sample size.</td>
              </tr>
              <tr>
                <td>4. Lead brief</td>
                <td>Claude Opus 5.5</td>
                <td>Sees only a list of computed facts, all aggregates. Writes the pattern, legitimate explanations to rule out, and next steps.</td>
              </tr>
              <tr>
                <td>5. Brief checks</td>
                <td>Code</td>
                <td>Every figure must appear in the facts. Words implying wrongdoing hold the brief. Citations must resolve and include a flagged pattern.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl className="facts">
          <div>
            <dt>Why a held brief, not a blocked lead</dt>
            <dd>The lead stands on the statistics. A failed check only sends the wording to an analyst to edit.</dd>
          </div>
          <div>
            <dt>Language rules</dt>
            <dd>Briefs describe billing patterns, not conduct, and never recommend recoupment or referrals. Those decisions need a records review.</dd>
          </div>
          <div>
            <dt>Privacy</dt>
            <dd>The model receives provider-level aggregates only, with no member data, so the PHI exposure is minimal by design.</dd>
          </div>
          <div>
            <dt>Known limit</dt>
            <dd>The number check confirms a figure exists in the facts, not that it&apos;s attached to the right measure. Analysts still read the brief.</dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Evaluation</span>
          <h2>Measured against injected patterns</h2>
          <p className="muted">
            {s.mode === "live"
              ? `Screen of ${SCREEN.cohortSize} synthetic providers. Briefs from a live run on ${s.model}, ${s.runAt.slice(0, 10)}.`
              : `Screen of ${SCREEN.cohortSize} synthetic providers. Briefs not yet measured against the model.`}
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
                <td>Screen precision</td>
                <td className="num">{pct(s.precision)}</td>
                <td>Leads that are injected patterns</td>
              </tr>
              <tr>
                <td>Screen recall</td>
                <td className="num">{pct(s.recall)}</td>
                <td>Injected patterns the screen found, each on the injected feature</td>
              </tr>
              <tr>
                <td>Decoys cleared</td>
                <td className="num">{pct(s.decoysCleared)}</td>
                <td>Raw outliers explained by patient risk that did not become leads</td>
              </tr>
              <tr>
                <td>Briefs passing checks</td>
                <td className="num">{pct(s.briefsPassed)}</td>
                <td>Briefs with every figure sourced, neutral language and valid citations</td>
              </tr>
              <tr>
                <td>Briefs citing the right pattern</td>
                <td className="num">{pct(s.briefsCiteRightPattern)}</td>
                <td>Brief cites the fact for the injected pattern</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The number check earned its place during development. On the first live run it held 5 of 6 briefs. One had invented
          &quot;60 to 75 minute sessions&quot; as an example, and others mentioned figures or codes that weren&apos;t in the facts. The
          fix was a tighter prompt, not a looser check.
        </p>
        <p className="callout">
          These patterns were injected into synthetic data by a generator I wrote, so the screen scores are a sanity check, not evidence of real-world performance.
          Real precision comes from closed investigation outcomes.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Path to production</span>
          <h2>What changes in a real deployment</h2>
        </div>
        <div className="grid g2">
          <div className="panel">
            <h3>Detection</h3>
            <ul>
              <li>Run on the plan&apos;s claims warehouse, by specialty and region, with billing and rendering NPIs separated</li>
              <li>Train isolation forest or XGBoost models on closed SIU cases alongside these explainable rules</li>
              <li>Add sequence and network features, such as shared patients and referral loops</li>
            </ul>
          </div>
          <div className="panel">
            <h3>Governance</h3>
            <ul>
              <li>Fair-treatment review of false-positive rates across specialties, regions and practice types</li>
              <li>Analyst feedback on each lead, feeding precision tracking and threshold tuning</li>
              <li>Case-management integration, with an audit trail from statistic to decision</li>
            </ul>
          </div>
        </div>
      </section>

      <SourceCode slug="payment-integrity-radar" />
    </div>
  );
}
