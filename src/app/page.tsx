import Link from "next/link";
import { AppCard } from "@/components/AppCard";
import { APPS, SITE } from "@/lib/site";

export default function Home() {
  return (
    <div className="wrap">
      <section className="hero hero-full">
        <span className="eyebrow">{SITE.title}</span>
        <h1>
          I design AI systems that health plans can <em>actually put into production.</em>
        </h1>
        <p className="lede">
          {SITE.yearsExperience} years building and architecting software, most recently for a U.S. healthcare payer. This site shows
          working AI applications for core plan workflows, with the evaluation, citations, human review and PHI handling a
          regulated environment needs.
        </p>
        <div className="stats">
          <span>
            <b>{SITE.yearsExperience} yrs</b>software &amp; architecture
          </span>
          <span>
            <b>{APPS.length}</b>payer AI applications
          </span>
          <span>
            <b>FHIR · X12 · CMS</b>standards I build on
          </span>
        </div>
        <div className="actions">
          <Link href="/apps/prior-auth-copilot/demo" className="btn">
            Try the Prior Auth Copilot
          </Link>
          <Link href="/apps" className="btn ghost">
            See all apps
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Applications</span>
          <h2>One app for each core payer workflow</h2>
        </div>
        <div className="grid g3">
          {APPS.map((a) => (
            <AppCard key={a.slug} app={a} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">How they are built</span>
          <h2>Same platform, same safeguards</h2>
        </div>
        <div className="grid g3">
          <div className="panel">
            <h3>Model output is checked in code</h3>
            <p className="muted">Every quote the model cites is matched against the source record. Routing rules live in code, not in the prompt.</p>
          </div>
          <div className="panel">
            <h3>People make coverage decisions</h3>
            <p className="muted">The AI recommends and routes. It never issues a denial; adverse determinations stay with clinicians.</p>
          </div>
          <div className="panel">
            <h3>Measured against labeled cases</h3>
            <p className="muted">Each app ships with a labeled test set and an eval script, so accuracy claims come with a number and a method.</p>
          </div>
        </div>
        <p>
          <Link href="/architecture">Read the reference architecture →</Link>
        </p>
      </section>
    </div>
  );
}
