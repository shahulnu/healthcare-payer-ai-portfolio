import data from "../../../data/pa/cases.json";
import type { PaCase } from "./types";

// Synthetic prior authorization cases, stored in data/pa/cases.json so the
// TypeScript engine and the Java service (healthcare-payer-ai-services/pa-engine-java, via contracts:sync) use the same
// records. Every person, identifier and phone number in them is invented; the notes
// include fake identifiers so the redaction step has something to remove.

export const CASES = data as PaCase[];

export function findCase(id: string): PaCase | undefined {
  return CASES.find((c) => c.id === id);
}
