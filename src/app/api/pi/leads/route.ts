import { NextResponse } from "next/server";
import { SCREEN } from "@/lib/pi/detect";
import { forwardToJava } from "@/lib/shared/engine-proxy";

export const runtime = "nodejs";

// When set (e.g. http://localhost:8084), this comes from the Java service in healthcare-payer-ai-services/pi-engine-java.
const JAVA_ENGINE = process.env.PI_ENGINE_URL;

export async function GET(req: Request) {
  if (JAVA_ENGINE) return forwardToJava(req, JAVA_ENGINE, "/api/pi/leads", { method: "GET" });
  return NextResponse.json(SCREEN);
}
