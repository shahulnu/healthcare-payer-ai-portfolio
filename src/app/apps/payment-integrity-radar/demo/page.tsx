import type { Metadata } from "next";
import { SCREEN } from "@/lib/pi/detect";
import { RadarDemo } from "./RadarDemo";

export const metadata: Metadata = { title: "Payment Integrity Radar demo" };

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const { lead } = await searchParams;
  const initial = SCREEN.leads.some((l) => l.providerId === lead) ? lead! : SCREEN.leads[0].providerId;
  return <RadarDemo screen={SCREEN} initialLeadId={initial} />;
}
