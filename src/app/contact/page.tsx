import type { Metadata } from "next";
import { CopyText } from "@/components/CopyText";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="wrap">
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Contact</span>
          <h1>Let&apos;s talk</h1>
          <p className="muted">
            Open to architecture roles and advisory work on AI for health plans. Email is the fastest way to reach me.
          </p>
        </div>
        <CopyText text={SITE.email} />
        <p>
          <a href={SITE.linkedin}>LinkedIn</a> · <a href={SITE.github}>GitHub</a>
        </p>
      </section>
    </div>
  );
}
