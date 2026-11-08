// Types for the HCC Evidence Finder.

import type { Usage } from "@/lib/shared/llm";

export interface ChartDocument {
  id: string;
  title: string;
  date: string;
  encounterType: string;
  provider: string;
  /** Whether this encounter can support risk adjustment: face-to-face with an acceptable provider type. */
  acceptable: boolean;
  text: string;
}

export interface ChartMember {
  id: string;
  label: string;
  plan: string;
  teaser: string;
  /** ICD-10 codes already submitted for risk adjustment. */
  submitted: string[];
  documents: ChartDocument[];
}

export interface CodeEntry {
  description: string;
  hcc: string | null;
  /** The code means the condition is active now, so "history of" language can't support it. */
  activeOnly?: boolean;
}

export interface HccMap {
  model: string;
  note: string;
  hccNames: Record<string, string>;
  codes: Record<string, CodeEntry>;
  hierarchies: Record<string, string[]>;
}

export type MeatElement = "M" | "E" | "A" | "T";
export type Assessment = "supported" | "not_supported" | "query_provider";
/**
 * add: supported, not yet submitted. confirmed: supported and submitted. superseded: supported, but a
 * higher HCC in the same hierarchy applies. review_deletion: submitted without support. query_provider:
 * documentation needs clarifying. no_hcc: the code doesn't affect risk adjustment. no_action: not
 * supported and never submitted.
 */
export type Disposition = "add" | "confirmed" | "superseded" | "review_deletion" | "query_provider" | "no_hcc" | "no_action";

export interface ConditionEvidence {
  element: MeatElement;
  docId: string;
  quote: string;
  verified: boolean;
  /** The quote comes from an encounter that can support risk adjustment. */
  acceptableSource: boolean;
}

export interface Finding {
  code: string;
  description: string;
  hcc: string | null;
  hccName: string | null;
  submitted: boolean;
  modelAssessment: Assessment | null;
  disposition: Disposition;
  /** Set when code overrode what the model said, or filled a gap. */
  codeNote: string | null;
  meatMet: MeatElement[];
  evidence: ConditionEvidence[];
  rationale: string;
}

export interface TraceStep {
  name: string;
  ms: number;
  detail: string;
}

export interface ModelCondition {
  icd10: string;
  assessment: Assessment;
  evidence: { element: MeatElement; doc_id: string; quote: string }[];
  rationale: string;
}

export interface ModelReview {
  conditions: ModelCondition[];
  summary: string;
}

export interface HccReview {
  engine?: "typescript" | "java";
  memberId: string;
  mode: "live" | "replay";
  replaySource?: "live" | "sample";
  model: string;
  hccModel: string;
  summary: string;
  findings: Finding[];
  counts: Record<Disposition, number>;
  redactions: { label: string; count: number }[];
  trace: TraceStep[];
  usage?: Usage;
  generatedAt: string;
  raw: ModelReview;
}
