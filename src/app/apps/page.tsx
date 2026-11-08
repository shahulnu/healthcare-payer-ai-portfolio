import type { Metadata } from "next";
import { AppCard } from "@/components/AppCard";
import { APPS } from "@/lib/site";

export const metadata: Metadata = { title: "Apps" };

export default function AppsPage() {
  return (
    <div className="wrap">
      <section className="section">
        <div className="section-head text-full">
          <span className="eyebrow">Applications</span>
          <h1>Payer AI apps</h1>
          <p className="muted">
            Each app targets one health plan workflow, runs on synthetic data, and has a case study covering the problem,
            architecture, evaluation and the path to production.
          </p>
        </div>
        <div className="grid g2">
          {APPS.map((a) => (
            <AppCard key={a.slug} app={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
