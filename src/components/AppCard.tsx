import Link from "next/link";
import type { AppEntry } from "@/lib/site";

export function AppCard({ app }: { app: AppEntry }) {
  const inner = (
    <>
      <div className="meta">
        <span className="eyebrow">{app.area}</span>
        {app.status === "live" ? <span className="pill p-ok">Live demo</span> : <span className="pill p-mute">In progress</span>}
      </div>
      <h3>{app.name}</h3>
      <p className="muted">{app.blurb}</p>
      <span className="mono muted">{app.technique}</span>
    </>
  );
  return app.status === "live" ? (
    <Link href={`/apps/${app.slug}`} className="panel app-card">
      {inner}
    </Link>
  ) : (
    <div className="panel app-card">{inner}</div>
  );
}
