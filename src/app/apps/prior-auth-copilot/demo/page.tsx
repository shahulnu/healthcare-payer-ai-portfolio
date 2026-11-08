import type { Metadata } from "next";
import { CASES } from "@/lib/pa/cases";
import { POLICIES } from "@/lib/pa/policies";
import { PaDemo } from "./PaDemo";

export const metadata: Metadata = { title: "Prior Auth Copilot demo" };

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ case?: string }> }) {
  const { case: requested } = await searchParams;
  const initial = CASES.some((c) => c.id === requested) ? requested! : CASES[0].id;
  return <PaDemo cases={CASES} policies={POLICIES} initialCaseId={initial} />;
}
