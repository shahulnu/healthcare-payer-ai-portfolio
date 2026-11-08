import { NextResponse } from "next/server";
import { findClaim } from "@/lib/appeals/claims";
import { analyzeClaim, ReplayMissingError } from "@/lib/appeals/engine";
import { errorResponse, resolveMode } from "@/lib/shared/api";
import { forwardToJava } from "@/lib/shared/engine-proxy";

export const runtime = "nodejs";
export const maxDuration = 180;

// When set (e.g. http://localhost:8082), requests go to the Java service in
// healthcare-payer-ai-services/appeals-engine-java, which returns the same JSON. Otherwise the TypeScript engine runs here.
const JAVA_ENGINE = process.env.APPEALS_ENGINE_URL;
const PATH = "/api/appeals/analyze";

export async function POST(req: Request) {
  let body: { claimId?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a claimId." }, { status: 400 });
  }
  if (JAVA_ENGINE) {
    return forwardToJava(req, JAVA_ENGINE, PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  const c = body.claimId ? findClaim(body.claimId) : undefined;
  if (!c) return NextResponse.json({ error: `Unknown claim "${body.claimId}".` }, { status: 404 });

  const { mode, notice } = resolveMode(req, body.mode);
  try {
    const analysis = await analyzeClaim(c, mode);
    return NextResponse.json({ ...analysis, engine: "typescript", notice });
  } catch (err) {
    if (err instanceof ReplayMissingError) return NextResponse.json({ error: err.message }, { status: 404 });
    return errorResponse(err);
  }
}

export async function GET(req: Request) {
  if (JAVA_ENGINE) return forwardToJava(req, JAVA_ENGINE, PATH, { method: "GET" });
  return NextResponse.json({ liveAvailable: Boolean(process.env.ANTHROPIC_API_KEY), engine: "typescript" });
}
