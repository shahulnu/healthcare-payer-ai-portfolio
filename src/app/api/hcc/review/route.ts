import { NextResponse } from "next/server";
import { findMember, reviewChart, ReplayMissingError } from "@/lib/hcc/engine";
import { errorResponse, resolveMode } from "@/lib/shared/api";
import { forwardToJava } from "@/lib/shared/engine-proxy";

export const runtime = "nodejs";
export const maxDuration = 120;

// When set (e.g. http://localhost:8085), requests go to the Java service in
// healthcare-payer-ai-services/hcc-engine-java, which returns the same JSON. Otherwise the TypeScript engine runs here.
const JAVA_ENGINE = process.env.HCC_ENGINE_URL;
const PATH = "/api/hcc/review";

export async function POST(req: Request) {
  let body: { memberId?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a memberId." }, { status: 400 });
  }
  if (JAVA_ENGINE) {
    return forwardToJava(req, JAVA_ENGINE, PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  const member = body.memberId ? findMember(body.memberId) : undefined;
  if (!member) return NextResponse.json({ error: `Unknown member "${body.memberId}".` }, { status: 404 });

  const { mode, notice } = resolveMode(req, body.mode);
  try {
    const review = await reviewChart(member, mode);
    return NextResponse.json({ ...review, engine: "typescript", notice });
  } catch (err) {
    if (err instanceof ReplayMissingError) return NextResponse.json({ error: err.message }, { status: 404 });
    return errorResponse(err);
  }
}

export async function GET(req: Request) {
  if (JAVA_ENGINE) return forwardToJava(req, JAVA_ENGINE, PATH, { method: "GET" });
  return NextResponse.json({ liveAvailable: Boolean(process.env.ANTHROPIC_API_KEY), engine: "typescript" });
}
