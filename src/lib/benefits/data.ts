import membersData from "../../../data/benefits/members.json";
import plansData from "../../../data/benefits/plans.json";
import servicesData from "../../../data/benefits/services.json";
import type { Member, Plan, Service } from "./types";

// Fictional plans, members and allowed amounts, stored in data/benefits/*.json.
// Allowed amounts are illustrative, not from any real price-transparency file.

export const PLANS = plansData as Plan[];
export const SERVICES = servicesData as Service[];
export const MEMBERS = membersData as Member[];

export const findMember = (id: string) => MEMBERS.find((m) => m.id === id);
export const findPlan = (id: string) => PLANS.find((p) => p.id === id);
export const findService = (id: string) => SERVICES.find((s) => s.id === id);

export function findSampleQuestion(questionId: string) {
  for (const m of MEMBERS) {
    const q = m.sampleQuestions.find((x) => x.id === questionId);
    if (q) return { member: m, question: q };
  }
  return undefined;
}
