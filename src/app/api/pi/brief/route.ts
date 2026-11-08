import { NextResponse } from "next/server";
import { findLead } from "@/lib/pi/detect";
import { briefLead, ReplayMissingError } from "@/lib/pi/engine";
import { errorResponse, resolveMode } from "@/lib/shared/api";
import { forwardToJava } from "@/lib/shared/engine-proxy";

export const runtime = "nodejs";
export const maxDuration = 120;

// When set (e.g. http://localhost:8084), requests go to the Java service in
// healthcare-payer-ai-services/pi-engine-java, which returns the same JSON. Otherwise the TypeScript engine runs here.
const JAVA_ENGINE = process.env.PI_ENGINE_URL;
const PATH = "/api/pi/brief";

export async function POST(req: Request) {
  let body: { providerId?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a providerId." }, { status: 400 });
  }
  if (JAVA_ENGINE) {
    return forwardToJava(req, JAVA_ENGINE, PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  const lead = body.providerId ? findLead(body.providerId) : undefined;
  if (!lead) return NextResponse.json({ error: `"${body.providerId}" isn't a lead in this screen.` }, { status: 404 });

  const { mode, notice } = resolveMode(req, body.mode);
  try {
    const brief = await briefLead(lead, mode);
    return NextResponse.json({ ...brief, engine: "typescript", notice });
  } catch (err) {
    if (err instanceof ReplayMissingError) return NextResponse.json({ error: err.message }, { status: 404 });
    return errorResponse(err);
  }
}

export async function GET(req: Request) {
  if (JAVA_ENGINE) return forwardToJava(req, JAVA_ENGINE, PATH, { method: "GET" });
  return NextResponse.json({ liveAvailable: Boolean(process.env.ANTHROPIC_API_KEY), engine: "typescript" });
}
