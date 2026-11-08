// Per-IP daily cap on live model runs, shared by every demo. In-memory, so it
// resets on redeploy and is per-instance on serverless hosts; good enough to
// protect a portfolio budget.

export const DAILY_LIMIT = Number(process.env.PA_DAILY_LIMIT_PER_IP ?? 10);
const usage = new Map<string, { day: string; count: number }>();

export function allowLive(ip: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(ip);
  if (!u || u.day !== day) {
    usage.set(ip, { day, count: 1 });
    return true;
  }
  if (u.count >= DAILY_LIMIT) return false;
  u.count += 1;
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
