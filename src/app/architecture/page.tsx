import type { Metadata } from "next";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { FLOW_STEPS } from "@/lib/architecture";

export const metadata: Metadata = { title: "Reference architecture" };

export default function ArchitecturePage() {
  return (
    <div className="wrap">
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Reference architecture</span>
          <h1>One platform behind every app</h1>
          <p className="muted">
            Each application is a thin workflow on a shared platform. The platform owns the hard parts once: identity, PHI
            handling, retrieval, evaluation and observability.
          </p>
        </div>
        <ArchitectureDiagram />
        <p className="muted small">
          Highlighted boxes are the controls that make AI output safe to act on in a health plan. Teal arrows carry requests,
          orange arrows carry results back, the dotted arrow is logging, and the numbers follow one request.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Request flow</span>
          <h2>One request, end to end</h2>
        </div>
        <ol className="flow-steps">
          {FLOW_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Decisions</span>
          <h2>Trade-offs I made, and why</h2>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Decision</th>
                <th>Choice</th>
                <th>Reasoning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Agent or workflow</td>
                <td>Fixed workflows</td>
                <td>Payer processes are well defined and audited. A fixed sequence is easier to test, explain to compliance and debug.</td>
              </tr>
              <tr>
                <td>Who decides</td>
                <td>Code routes, people decide</td>
                <td>The model produces findings. Routing thresholds sit in code where they can be reviewed and versioned.</td>
              </tr>
              <tr>
                <td>Trusting citations</td>
                <td>Verbatim match check</td>
                <td>A cheap deterministic check catches paraphrased or invented evidence before a reviewer sees it.</td>
              </tr>
              <tr>
                <td>RAG vs. fine-tuning</td>
                <td>Retrieval</td>
                <td>Medical policies change every quarter. Retrieval picks up a new version the day it&apos;s published.</td>
              </tr>
              <tr>
                <td>Hosting</td>
                <td>AWS, Claude on Bedrock</td>
                <td>Most large payers already run on AWS under a BAA, so no new vendor review is needed.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
