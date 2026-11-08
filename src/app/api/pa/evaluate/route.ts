import { NextResponse } from "next/server";
import { findCase } from "@/lib/pa/cases";
import { evaluateCase } from "@/lib/pa/engine";
import { errorResponse, resolveMode } from "@/lib/shared/api";
import { forwardToJava } from "@/lib/shared/engine-proxy";

export const runtime = "nodejs";
export const maxDuration = 120;

// When set (e.g. http://localhost:8081), requests go to the Java service in
// healthcare-payer-ai-services/pa-engine-java, which returns the same JSON. Otherwise the TypeScript engine runs here.
const JAVA_ENGINE = process.env.PA_ENGINE_URL;
const PATH = "/api/pa/evaluate";

export async function POST(req: Request) {
  let body: { caseId?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a caseId." }, { status: 400 });
  }
  if (JAVA_ENGINE) {
    return forwardToJava(req, JAVA_ENGINE, PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  const c = body.caseId ? findCase(body.caseId) : undefined;
  if (!c) return NextResponse.json({ error: `Unknown case "${body.caseId}".` }, { status: 404 });

  const { mode, notice } = resolveMode(req, body.mode);
  try {
    const evaluation = await evaluateCase(c, mode);
    return NextResponse.json({ ...evaluation, engine: "typescript", notice });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(req: Request) {
  if (JAVA_ENGINE) return forwardToJava(req, JAVA_ENGINE, PATH, { method: "GET" });
  return NextResponse.json({ liveAvailable: Boolean(process.env.ANTHROPIC_API_KEY), engine: "typescript" });
}
