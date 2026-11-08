import data from "../../../data/pa/policies.json";
import type { CoveragePolicy } from "./types";

// Illustrative coverage policies written for this demo, stored in
// data/pa/policies.json and shared with the Java service. They are modeled on the
// kind of criteria payers publish, but they are NOT the text of any real LCD, NCD
// or commercial medical policy.

export const POLICIES = data as CoveragePolicy[];

export function findPolicy(serviceCode: string): CoveragePolicy | undefined {
  return POLICIES.find((p) => p.serviceCodes.includes(serviceCode));
}
