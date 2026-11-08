// Personal details and the app catalog. Edit this file to make the site yours.

export const SITE = {
  name: "Shahul Ummarali",
  title: "Software Architect · Healthcare Payer AI",
  domain: "shahul.ai",
  email: "ShahulHameed.NU@gmail.com",
  linkedin: "https://www.linkedin.com/in/shahulnu",
  github: "https://github.com/shahulnu",
  resumeUrl: "/resume.pdf",
  yearsExperience: "20+",
};

export interface AppEntry {
  slug: string;
  name: string;
  area: string;
  technique: string;
  blurb: string;
  status: "live" | "planned";
}

export const APPS: AppEntry[] = [
  {
    slug: "prior-auth-copilot",
    name: "Prior Auth Copilot",
    area: "Utilization management",
    technique: "LLM criteria review with verified citations",
    blurb: "Checks a prior authorization request against the coverage policy, one criterion at a time, and cites the evidence for a nurse reviewer.",
    status: "live",
  },
  {
    slug: "denial-appeals-assistant",
    name: "Denial & Appeals Assistant",
    area: "Claims",
    technique: "Evidence-checked analysis and drafting",
    blurb: "Explains each denied line from its CARC/RARC codes, decides whether to appeal or correct it, and drafts the appeal from verified evidence.",
    status: "live",
  },
  {
    slug: "benefits-navigator",
    name: "Benefits Navigator",
    area: "Member services",
    technique: "Tool-using agent with checked answers",
    blurb: "Answers coverage questions from the member's own plan documents, gets cost estimates from a calculator tool, and checks every citation and dollar figure.",
    status: "live",
  },
  {
    slug: "payment-integrity-radar",
    name: "Payment Integrity Radar",
    area: "Fraud, waste & abuse",
    technique: "Robust peer statistics with checked LLM briefs",
    blurb: "Finds providers whose billing stands out from risk-adjusted specialty peers, then writes a neutral, fact-checked brief for investigators.",
    status: "live",
  },
  {
    slug: "hcc-evidence-finder",
    name: "HCC Evidence Finder",
    area: "Risk adjustment",
    technique: "MEAT evidence review with code-owned HCC rules",
    blurb: "Compares charts with submitted codes in both directions: missed conditions with MEAT evidence, and unsupported codes to review before a RADV audit.",
    status: "live",
  },
];
