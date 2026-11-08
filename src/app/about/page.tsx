import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "About" };

// Career history from the LinkedIn Experience section. Employers are named; clients
// are described by industry. LinkedIn lists no achievements for these roles, so the
// highlights stick to scope. Add measurable outcomes as you document them.
const CAREER = [
  {
    years: "2022–now",
    role: "Senior Software Architect",
    org: "Cognizant",
    place: "Toronto, Canada · Remote",
    highlights: "Architecture for a U.S. healthcare payer client, focused on digital transformation and cloud migration.",
  },
  {
    years: "2017–2022",
    role: "Software Architect",
    org: "Cognizant",
    place: "United States · On-site",
    highlights: "Solution architecture for enterprise Java EE systems, working on-site with U.S. clients.",
  },
  {
    years: "2012–2017",
    role: "Senior Associate, Lead Developer",
    org: "Cognizant",
    place: "United States · On-site",
    highlights: "Led development of enterprise Java applications for U.S. clients.",
  },
  {
    years: "2010–2012",
    role: "Senior Software Developer",
    org: "Royal Bank of Scotland",
    place: "Chennai, India",
    highlights: "Java EE development for banking systems.",
  },
  {
    years: "2006–2010",
    role: "Associate Consultant, Software Developer",
    org: "Capgemini",
    place: "Chennai, India · Oslo, Norway",
    highlights: "Java EE and Spring development, including an on-site assignment in Oslo.",
  },
];

export default function AboutPage() {
  return (
    <div className="wrap">
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">About</span>
          <h1>{SITE.name}</h1>
          <p className="muted">{SITE.title}</p>
        </div>
        <p>
          I have spent {SITE.yearsExperience} years designing and building software, at Capgemini, Royal Bank of Scotland
          and, since 2012, Cognizant. I have worked as an architect since 2017, most recently for a U.S. healthcare payer
          client. I work across claims, enrollment, utilization management and provider data, and I focus on
          bringing generative AI into those systems in ways that compliance, clinical and operations teams can sign off on.
        </p>
        <div className="actions">
          <a href={SITE.resumeUrl} className="btn">
            Download resume (PDF)
          </a>
          <a href={SITE.linkedin} className="btn ghost">
            LinkedIn
          </a>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Domain coverage</span>
          <h2>Where I have worked in the payer stack</h2>
        </div>
        <div className="grid g3">
          <div className="panel">
            <h3>Core administration</h3>
            <p className="muted">Claims adjudication, enrollment and eligibility, X12 837/835/834/270-271.</p>
          </div>
          <div className="panel">
            <h3>Clinical & UM</h3>
            <p className="muted">Prior authorization (X12 278, Da Vinci PAS/CRD/DTR), care management, HEDIS.</p>
          </div>
          <div className="panel">
            <h3>Interoperability</h3>
            <p className="muted">FHIR R4 APIs for Patient Access, Provider Directory and Payer-to-Payer exchange.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Career</span>
          <h2>Timeline</h2>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Years</th>
                <th>Role</th>
                <th>Highlights</th>
              </tr>
            </thead>
            <tbody>
              {CAREER.map((c) => (
                <tr key={`${c.years}-${c.role}`}>
                  <td className="mono nowrap">{c.years}</td>
                  <td>
                    <b>{c.role}</b>
                    <br />
                    {c.org}
                    <br />
                    <span className="muted small">{c.place}</span>
                  </td>
                  <td>{c.highlights}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
