import type { Metadata } from "next";
import { MEMBERS, PLANS } from "@/lib/benefits/data";
import { BenefitsDemo } from "./BenefitsDemo";

export const metadata: Metadata = { title: "Benefits Navigator demo" };

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const { member } = await searchParams;
  const initial = MEMBERS.some((m) => m.id === member) ? member! : MEMBERS[0].id;
  return <BenefitsDemo members={MEMBERS} plans={PLANS} initialMemberId={initial} />;
}
