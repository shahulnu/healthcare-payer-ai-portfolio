import data from "../../../data/appeals/policies.json";
import type { PaymentPolicy } from "./types";

// Illustrative payment policies written for this demo, stored in
// data/appeals/policies.json and shared with the Java service. They resemble the kind
// of rules payers publish, but they are not the text of any real payer's policy.

export const PAYMENT_POLICIES = data as PaymentPolicy[];

export const findPolicies = (ids: string[]) => PAYMENT_POLICIES.filter((p) => ids.includes(p.id));
