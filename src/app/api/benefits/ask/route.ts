import { NextResponse } from "next/server";
import { findMember, findSampleQuestion } from "@/lib/benefits/data";
import { answerQuestion, ReplayMissingError } from "@/lib/benefits/engine";
import { errorResponse, resolveMode } from "@/lib/shared/api";
import { forwardToJava } from "@/lib/shared/engine-proxy";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_QUESTION = 500;

// When set (e.g. http://localhost:8083), requests go to the Java service in
// healthcare-payer-ai-services/benefits-engine-java, which returns the same JSON. Otherwise the TypeScript engine runs here.
const JAVA_ENGINE = process.env.BENEFITS_ENGINE_URL;
const PATH = "/api/benefits/ask";

export async function POST(req: Request) {
  let body: { memberId?: string; questionId?: string; question?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a memberId and a questionId or question." }, { status: 400 });
  }
  if (JAVA_ENGINE) {
    return forwardToJava(req, JAVA_ENGINE, PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  // A sample question carries its member; a typed question needs one.
  const sample = body.questionId ? findSampleQuestion(body.questionId) : undefined;
  if (body.questionId && !sample) return NextResponse.json({ error: `Unknown sample question "${body.questionId}".` }, { status: 404 });
  const member = sample?.member ?? (body.memberId ? findMember(body.memberId) : undefined);
  if (!member) return NextResponse.json({ error: `Unknown member "${body.memberId}".` }, { status: 404 });

  const question = (sample?.question.text ?? body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  if (question.length > MAX_QUESTION) return NextResponse.json({ error: `Keep questions under ${MAX_QUESTION} characters.` }, { status: 400 });

  const { mode, notice } = resolveMode(req, body.mode);
  try {
    const answer = await answerQuestion(member, question, sample?.question.id ?? null, mode);
    return NextResponse.json({ ...answer, engine: "typescript", notice });
  } catch (err) {
    if (err instanceof ReplayMissingError) return NextResponse.json({ error: err.message }, { status: 404 });
    return errorResponse(err);
  }
}

export async function GET(req: Request) {
  if (JAVA_ENGINE) return forwardToJava(req, JAVA_ENGINE, PATH, { method: "GET" });
  return NextResponse.json({ liveAvailable: Boolean(process.env.ANTHROPIC_API_KEY), engine: "typescript" });
}
