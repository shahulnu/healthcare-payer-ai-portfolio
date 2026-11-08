import type { Metadata } from "next";
import { HCC_MAP, MEMBERS } from "@/lib/hcc/engine";
import { HccDemo } from "./HccDemo";

export const metadata: Metadata = { title: "HCC Evidence Finder demo" };

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const { member } = await searchParams;
  const initial = MEMBERS.some((m) => m.id === member) ? member! : MEMBERS[0].id;
  return <HccDemo members={MEMBERS} map={HCC_MAP} initialMemberId={initial} />;
}
