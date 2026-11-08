import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, JetBrains_Mono, Source_Sans_3 } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });
const body = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: `${SITE.name} · Healthcare Payer AI`, template: `%s · ${SITE.name}` },
  description:
    "Working AI applications for health plans: prior authorization, claims, member services, payment integrity and risk adjustment. Built on synthetic data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions (Grammarly, password managers, ColorZilla...) add attributes to
    // <html> and <body> before React loads. This only silences mismatches on these two
    // elements' own attributes; mismatches anywhere else are still reported.
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">
              {SITE.name} <span>· AI Architecture</span>
            </Link>
            <nav className="site-nav" aria-label="Main">
              <Link href="/apps">Apps</Link>
              <Link href="/architecture">Architecture</Link>
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <span>All demos use synthetic data and illustrative policies. Not for clinical or coverage decisions.</span>
            <span>
              <a href={SITE.linkedin}>LinkedIn</a> · <a href={SITE.github}>GitHub</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
