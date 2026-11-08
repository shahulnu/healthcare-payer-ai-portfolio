import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { allowLive, clientIp, DAILY_LIMIT } from "./live-limit";
import { ModelDeclinedError } from "./llm";

/** Picks live or replay for a demo request and explains any downgrade to replay. */
export function resolveMode(req: Request, requested: string | undefined): { mode: "live" | "replay"; notice?: string } {
  if (requested !== "live") return { mode: "replay" };
  if (!process.env.ANTHROPIC_API_KEY) return { mode: "replay", notice: "Live mode is off on this deployment, so this is a replay." };
  if (!allowLive(clientIp(req))) return { mode: "replay", notice: `Daily limit of ${DAILY_LIMIT} live runs reached, so this is a replay.` };
  return { mode: "live" };
}

/** Maps engine and SDK errors to responses a demo page can show as-is. */
export function errorResponse(err: unknown) {
  if (err instanceof ModelDeclinedError) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return NextResponse.json({ error: "The model is rate limited. Try again in a minute or use replay." }, { status: 429 });
  }
  if (err instanceof Anthropic.APIError) {
    return NextResponse.json({ error: `Model API error ${err.status}. Try replay mode.` }, { status: 502 });
  }
  console.error(err);
  return NextResponse.json({ error: "The request failed." }, { status: 500 });
}
