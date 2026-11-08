// Types for Payment Integrity Radar.

import type { Usage } from "@/lib/shared/llm";

export interface Provider {
  id: string;
  specialty: "Family Medicine" | "Physical Therapy";
  encounters: number;
  patients?: number;
  patientRiskScore?: number;
  level5Share?: number;
  level4Share?: number;
  modifier25Rate?: number;
  allowedPerPatient?: number;
  unitsPerVisit?: number;
  fourPlusUnitShare?: number;
  visitsPerPatient?: number;
  modifier59Rate?: number;
  peakDayHours: number;
}

export type Tier = "high" | "medium" | "none";

export interface FeatureResult {
  id: string;
  label: string;
  value: number;
  display: string;
  peerMedian: number;
  peerDisplay: string;
  /** Risk-adjusted expected value, for features adjusted for case mix. */
  expected: number | null;
  expectedDisplay: string | null;
  /** Robust z-score used for flagging: risk-adjusted where the feature is adjusted. */
  z: number;
  /** Robust z-score against peers before any adjustment. */
  rawZ: number;
  flagged: boolean;
  hardRule: boolean;
}

export interface Lead {
  providerId: string;
  specialty: string;
  encounters: number;
  tier: Tier;
  score: number;
  features: FeatureResult[];
  flaggedLabels: string[];
  /** Billing above the peer pattern. An estimate for sizing the lead, not an overpayment finding. */
  exposure: number;
  /** A raw outlier that risk adjustment explained. */
  clearedByAdjustment: boolean;
}

export interface PeerPoint {
  id: string;
  value: number;
  risk?: number;
}

export interface Screen {
  period: string;
  cohortSize: number;
  leads: Lead[];
  cleared: Lead[];
  peers: Record<string, Record<string, PeerPoint[]>>;
  /** Risk adjustment line for the 99215 share: expected = intercept + slope x risk. */
  level5Line: { slope: number; intercept: number };
}

export interface Fact {
  id: string;
  text: string;
  flagged: boolean;
}

export interface BriefText {
  headline: string;
  pattern: string;
  alternative_explanations: string[];
  next_steps: string[];
  cited_fact_ids: string[];
}

export interface TraceStep {
  name: string;
  ms: number;
  detail: string;
}

export interface PiBrief {
  engine?: "typescript" | "java";
  providerId: string;
  mode: "live" | "replay";
  replaySource?: "live" | "sample";
  model: string;
  status: "ready" | "held";
  holdReasons: string[];
  tier: Tier;
  action: string;
  brief: BriefText;
  facts: Fact[];
  numberCheck: { found: string[]; unsupported: string[] };
  languageCheck: { flagged: string[] };
  citationCheck: { cited: string[]; unknown: string[]; citesFlagged: boolean };
  trace: TraceStep[];
  usage?: Usage;
  generatedAt: string;
  raw: BriefText;
}
