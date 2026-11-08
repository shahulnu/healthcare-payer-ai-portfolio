import { NextResponse } from "next/server";

/**
 * Forwards a demo API request to one of the Java services in the healthcare-payer-ai-services project, which return the same
 * JSON as the TypeScript engines. `base` comes from PA_ENGINE_URL or APPEALS_ENGINE_URL.
 */
export async function forwardToJava(req: Request, base: string, path: string, init: RequestInit) {
  const url = `${base.replace(/\/$/, "")}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), "X-Forwarded-For": req.headers.get("x-forwarded-for") ?? "local" },
      cache: "no-store",
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: `The Java engine at ${base} isn't reachable. Start it, or unset the engine URL.` }, { status: 502 });
  }
}
