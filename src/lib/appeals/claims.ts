import data from "../../../data/appeals/claims.json";
import type { DeniedClaim } from "./types";

// Synthetic denied claims, stored in data/appeals/claims.json so the TypeScript engine
// and the Java service (healthcare-payer-ai-services/appeals-engine-java, via contracts:sync) use the same records. Every
// person, identifier and phone number is invented; the records include fake
// identifiers so the redaction step has work to do.

export const CLAIMS = data as DeniedClaim[];

export const findClaim = (id: string) => CLAIMS.find((c) => c.id === id);
