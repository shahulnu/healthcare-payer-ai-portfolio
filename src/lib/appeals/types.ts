// Types for the Denial & Appeals Assistant.

import type { Usage } from "@/lib/shared/llm";

export interface Adjustment {
  /** X12 claim adjustment group: CO contractual obligation, PR patient responsibility, OA other. */
  group: "CO" | "PR" | "OA";
  carc: string;
  amount: number;
}

/** One service line as reported on the remittance advice (X12 835). */
export interface RemitLine {
  line: number;
  code: string;
  modifiers: string[];
  units: number;
  description: string;
  billed: number;
  paid: number;
  adjustments: Adjustment[];
  remarks: string[];
}

export interface ClaimDocument {
  id: string;
  kind: "plan_of_care" | "progress_note" | "office_note" | "procedure_note" | "submission_history";
  title: string;
  date: string;
  text: string;
}

export interface PaymentPolicy {
  id: string;
  title: string;
  text: string;
}

export interface DeniedClaim {
  id: string;
  payerClaimId: string;
  dateOfService: string;
  remitDate: string;
  member: { id: string; age: number; sex: "F" | "M"; plan: string };
  provider: { name: string; specialty: string };
  diagnosis: string[];
  lines: RemitLine[];
  documents: ClaimDocument[];
  policyIds: string[];
  teaser: string;
}

export type Category =
  | "medical_necessity"
  | "authorization"
  | "coding"
  | "timely_filing"
  | "duplicate"
  | "eligibility"
  | "documentation"
  | "other";

export type Action = "appeal" | "corrected_claim" | "no_action";
export type Strength = "strong" | "moderate" | "weak";

export interface LineEvidence {
  docId: string;
  quote: string;
  verified: boolean;
  /** From the claim's own records, not from the payer policy. */
  fromRecord: boolean;
}

export interface LineFinding {
  line: number;
  code: string;
  billed: number;
  denialCodes: string[];
  explanation: string;
  category: Category;
  /** What the model suggested. */
  modelAction: Action;
  /** After code checks the evidence. */
  action: Action;
  strength: Strength | null;
  evidence: LineEvidence[];
  nextSteps: string;
  downgraded: boolean;
}

export interface TraceStep {
  name: string;
  ms: number;
  detail: string;
}

export interface Analysis {
  /** Which engine produced the result: this app ("typescript") or healthcare-payer-ai-services/appeals-engine-java ("java"). */
  engine?: "typescript" | "java";
  claimId: string;
  mode: "live" | "replay";
  /** In replay mode: whether the stored output came from a real model run. */
  replaySource?: "live" | "sample";
  model: string;
  summary: string;
  findings: LineFinding[];
  recoverable: number;
  correctedClaim: string | null;
  letter: { text: string; quotes: number; quotesVerified: number } | null;
  redactions: { label: string; count: number }[];
  trace: TraceStep[];
  usage?: Usage;
  generatedAt: string;
}
