import type { Metadata } from "next";
import { CLAIMS } from "@/lib/appeals/claims";
import { CARC, GROUP_CODES, RARC } from "@/lib/appeals/codes";
import { AppealsDemo } from "./AppealsDemo";

export const metadata: Metadata = { title: "Denial & Appeals Assistant demo" };

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ claim?: string }> }) {
  const { claim } = await searchParams;
  const initial = CLAIMS.some((c) => c.id === claim) ? claim! : CLAIMS[0].id;
  return <AppealsDemo claims={CLAIMS} codes={{ CARC, RARC, GROUP_CODES }} initialClaimId={initial} />;
}
