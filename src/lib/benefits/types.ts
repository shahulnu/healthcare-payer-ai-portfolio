// Types for the Benefits Navigator.

import type { Usage } from "@/lib/shared/llm";

export type Network = "in" | "out";

export type CostRule =
  | { kind: "copay"; amount: number; priorAuth?: boolean; referral?: boolean; visitLimit?: number }
  | { kind: "coinsurance"; rate: number; priorAuth?: boolean; referral?: boolean; visitLimit?: number }
  | { kind: "no_charge" }
  | { kind: "not_covered" };

export interface PlanSection {
  id: string;
  doc: "SBC" | "EOC";
  page: number;
  title: string;
  text: string;
}

export interface Plan {
  id: string;
  name: string;
  type: "PPO" | "HMO";
  planYear: string;
  sourceNote: string;
  sections: PlanSection[];
  rules: Record<string, Record<Network, CostRule>>;
  limits: { deductible: { in: number; out: number | null }; oopMax: { in: number; out: number | null } };
}

export interface Service {
  id: string;
  name: string;
  code: string;
  category: string;
  allowed: Record<Network, number>;
}

export interface Member {
  id: string;
  label: string;
  planId: string;
  accumulatorsAsOf: string;
  accumulators: { deductibleMet: Record<Network, number>; oopMet: Record<Network, number> };
  sampleQuestions: { id: string; text: string }[];
}

export interface CostEstimate {
  serviceId: string;
  serviceName: string;
  network: Network;
  covered: boolean;
  allowedAmount: number;
  deductiblePortion: number;
  coinsurancePortion: number;
  copay: number;
  memberPays: number;
  planPays: number;
  /** Requirements and caveats from the plan rules, e.g. prior authorization. */
  notes: string[];
}

export interface ToolCall {
  name: string;
  input: unknown;
  output: unknown;
}

export interface Citation {
  sectionId: string;
  doc: string;
  page: number | null;
  title: string;
  quote: string;
  verified: boolean;
}

export interface TraceStep {
  name: string;
  ms: number;
  detail: string;
}

/** What the model submitted through the submit_answer tool. */
export interface Submission {
  answer: string;
  citations: { section_id: string; quote: string }[];
  needs_human: boolean;
  escalation_reason: string;
}

/** Enough to replay a run: the tool calls the model made and its final submission. */
export interface RecordedRun {
  toolCalls: { name: string; input: unknown }[];
  submission: Submission | null;
}

export interface BenefitsAnswer {
  engine?: "typescript" | "java";
  memberId: string;
  planName: string;
  questionId: string | null;
  question: string;
  mode: "live" | "replay";
  replaySource?: "live" | "sample";
  model: string;
  status: "answered" | "escalated";
  answer: string;
  escalationReason: string | null;
  citations: Citation[];
  estimates: CostEstimate[];
  /** Dollar amounts in the answer, and any that don't come from a section read or a cost estimate. */
  numberCheck: { found: string[]; unsupported: string[] };
  toolCalls: ToolCall[];
  trace: TraceStep[];
  usage?: Usage;
  generatedAt: string;
  raw: RecordedRun;
}
