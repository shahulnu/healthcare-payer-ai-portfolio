// Shared types for the Prior Auth Copilot.

export type CriterionStatus = "met" | "not_met" | "insufficient";

export interface PolicyCriterion {
  id: string;
  text: string;
  /** What a reviewer would look for in the record. Given to the model as guidance. */
  guidance: string;
}

export interface CoveragePolicy {
  id: string;
  title: string;
  /** CPT/HCPCS or NDC-level service codes this policy applies to. */
  serviceCodes: string[];
  benefit: "medical" | "pharmacy";
  /** All criteria are required in these sample policies. */
  criteria: PolicyCriterion[];
  sourceNote: string;
}

export interface CaseDocument {
  id: string;
  kind: "clinical_note" | "claims_history" | "imaging_report" | "pharmacy_history";
  title: string;
  date: string;
  text: string;
}

export interface PaCase {
  id: string;
  receivedAt: string;
  urgency: "standard" | "expedited";
  member: { id: string; age: number; sex: "F" | "M"; plan: string };
  provider: { name: string; specialty: string; network: "in" | "out" };
  service: { code: string; codeSystem: "CPT" | "HCPCS" | "NDC"; description: string; diagnosis: string[] };
  documents: CaseDocument[];
  /** One-line hint for the demo picker. */
  teaser: string;
}

export interface Evidence {
  docId: string;
  quote: string;
  /** Set by the citation check: true when the quote is found verbatim in the redacted document. */
  verified: boolean;
}

export interface CriterionResult {
  id: string;
  text: string;
  /** What the model said. */
  modelStatus: CriterionStatus;
  /** After the citation check. "met" without verified evidence is downgraded to "insufficient". */
  status: CriterionStatus;
  evidence: Evidence[];
  rationale: string;
  downgraded: boolean;
}

export type Route = "recommend_approve" | "nurse_review" | "request_info";

export interface TraceStep {
  name: string;
  ms: number;
  detail: string;
}

export interface Evaluation {
  /** Which engine produced the result: this app ("typescript") or healthcare-payer-ai-services/pa-engine-java ("java"). */
  engine?: "typescript" | "java";
  caseId: string;
  policyId: string;
  policyTitle: string;
  mode: "live" | "replay";
  model: string;
  route: Route;
  routeReason: string;
  summary: string;
  criteria: CriterionResult[];
  redactions: { label: string; count: number }[];
  trace: TraceStep[];
  usage?: { inputTokens: number; outputTokens: number; estCostUsd: number };
  /** Due date under the CMS-0057-F timeframes (72h expedited, 7 calendar days standard). */
  decisionDueBy: string;
  generatedAt: string;
}
