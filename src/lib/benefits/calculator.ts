import type { CostEstimate, Member, Network, Plan, Service } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The plan's cost calculator. Deterministic: it applies the member's remaining deductible,
 * coinsurance or copay, and remaining out-of-pocket limit to the service's allowed amount.
 * The model asks for estimates through the estimate_cost tool but never does this math itself.
 */
export function estimateCost(plan: Plan, member: Member, service: Service, network: Network): CostEstimate {
  const rule = plan.rules[service.category]?.[network] ?? { kind: "not_covered" as const };
  const allowed = service.allowed[network];
  const base = { serviceId: service.id, serviceName: service.name, network, allowedAmount: allowed };
  const notes: string[] = [];

  if (rule.kind === "not_covered") {
    notes.push(
      network === "out" && plan.type === "HMO"
        ? "Not covered out of network except emergencies. The member pays the full cost, and it doesn't count toward the deductible or out-of-pocket limit."
        : "Not a covered service. The member pays the full cost.",
    );
    return { ...base, covered: false, deductiblePortion: 0, coinsurancePortion: 0, copay: 0, memberPays: allowed, planPays: 0, notes };
  }

  // Emergency care out of network is paid at the in-network level (No Surprises Act protections).
  const acc: Network = service.category === "emergency" ? "in" : network;
  const deductible = plan.limits.deductible[acc] ?? 0;
  const oopMax = plan.limits.oopMax[acc] ?? Infinity;
  const dedRemaining = Math.max(0, deductible - member.accumulators.deductibleMet[acc]);
  const oopRemaining = Math.max(0, oopMax - member.accumulators.oopMet[acc]);

  let deductiblePortion = 0;
  let coinsurancePortion = 0;
  let copay = 0;
  if (rule.kind === "copay") {
    copay = Math.min(rule.amount, allowed);
  } else if (rule.kind === "coinsurance") {
    deductiblePortion = Math.min(allowed, dedRemaining);
    coinsurancePortion = (allowed - deductiblePortion) * rule.rate;
  }
  let memberPays = deductiblePortion + coinsurancePortion + copay;
  if (memberPays > oopRemaining) {
    notes.push(`Capped at the remaining out-of-pocket limit of $${oopRemaining.toFixed(2)}.`);
    memberPays = oopRemaining;
  }

  if (rule.kind !== "no_charge") {
    if (rule.priorAuth) notes.push("Prior authorization is required.");
    if (rule.referral) notes.push("A referral from the primary care provider is required.");
    if (rule.visitLimit) notes.push(`Limited to ${rule.visitLimit} visits per calendar year.`);
  }
  if (network === "out" && plan.type === "PPO" && service.category !== "emergency") {
    notes.push("The provider may also balance bill the difference between their charge and the allowed amount.");
  }

  return {
    ...base,
    covered: true,
    deductiblePortion: round2(deductiblePortion),
    coinsurancePortion: round2(coinsurancePortion),
    copay: round2(copay),
    memberPays: round2(memberPays),
    planPays: round2(allowed - memberPays),
    notes,
  };
}
