"use client";

// Overall platform architecture as an inline SVG. Colors come from CSS classes
// in globals.css (.arch-*), so the diagram follows the light/dark theme.
// Connectors show marching dashes in the direction of flow, and a dot walks one
// request through steps 1-9. Both stop for visitors who prefer reduced motion.
// scripts/make-architecture-gif.js keeps a copy of this layout for the GIF.

import { useEffect, useRef, useState } from "react";
import { FLOW_STEPS } from "@/lib/architecture";

type Pt = [number, number];

interface BoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  sub?: string[];
  keyControl?: boolean;
  lit?: boolean;
}

function Box({ x, y, w, h, lines, sub = [], keyControl, lit }: BoxProps) {
  const total = lines.length * 17 + sub.length * 15;
  let ty = y + h / 2 - total / 2 + 13;
  const cls = ["arch-box", keyControl ? "arch-key" : "", lit ? "arch-lit" : ""].join(" ").trim();
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} className={cls} />
      {lines.map((l) => {
        const t = (
          <text key={`l-${l}`} x={x + w / 2} y={ty} textAnchor="middle" className="arch-label">
            {l}
          </text>
        );
        ty += 17;
        return t;
      })}
      {sub.map((s) => {
        const t = (
          <text key={`s-${s}`} x={x + w / 2} y={ty} textAnchor="middle" className="arch-sub">
            {s}
          </text>
        );
        ty += 15;
        return t;
      })}
    </g>
  );
}

function Frame({ x, y, w, h, title }: { x: number; y: number; w: number; h: number; title: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} className="arch-frame" />
      <text x={x + 2} y={y - 9} className="arch-head">
        {title}
      </text>
    </g>
  );
}

type BoxId =
  | "inbound" | "portals" | "callctr" | "reviewer" | "gateway" | "redact" | "inject" | "workflows" | "checks" | "human"
  | "claude" | "ml" | "policy" | "search" | "fhir" | "claims" | "calc" | "tests" | "evals" | "tracing" | "audit" | "risk";

const BOXES: Record<BoxId, Omit<BoxProps, "lit">> = {
  inbound: { x: 20, y: 70, w: 180, h: 56, lines: ["Inbound transactions"], sub: ["X12 278 · 837 · FHIR PAS"] },
  portals: { x: 20, y: 140, w: 180, h: 50, lines: ["Member & provider", "portals"] },
  callctr: { x: 20, y: 204, w: 180, h: 50, lines: ["Call-center desktop"] },
  reviewer: { x: 20, y: 268, w: 180, h: 50, lines: ["Reviewer workbench"], sub: ["nurse / physician UI"] },
  gateway: { x: 250, y: 70, w: 180, h: 60, lines: ["API gateway"], sub: ["SSO · rate limits"] },
  redact: { x: 250, y: 165, w: 180, h: 50, lines: ["Identifier redaction"], sub: ["PHI removed pre-model"], keyControl: true },
  inject: { x: 250, y: 250, w: 180, h: 50, lines: ["Prompt-injection", "screen"] },
  workflows: {
    x: 480, y: 70, w: 280, h: 130, lines: ["Use-case workflows"],
    sub: ["Prior authorization", "Denials & appeals", "Benefits Q&A", "Payment integrity", "HCC evidence"], keyControl: true,
  },
  checks: { x: 480, y: 220, w: 280, h: 50, lines: ["Citation check + routing rules"], sub: ["deterministic code"], keyControl: true },
  human: { x: 480, y: 290, w: 280, h: 50, lines: ["Human review queue"], sub: ["a clinician makes every decision"], keyControl: true },
  claude: { x: 820, y: 70, w: 280, h: 70, lines: ["Claude Opus 5.5"], sub: ["Amazon Bedrock or Claude API", "structured output · prompt cache"] },
  ml: { x: 820, y: 160, w: 280, h: 56, lines: ["Classic ML · XGBoost"], sub: ["FWA outliers · overturn scoring"] },
  policy: { x: 482, y: 418, w: 116, h: 56, lines: ["Policy library"], sub: ["versioned"] },
  search: { x: 606, y: 418, w: 116, h: 56, lines: ["Hybrid search"], sub: ["pgvector"] },
  fhir: { x: 730, y: 418, w: 116, h: 56, lines: ["FHIR server"], sub: ["HAPI · Synthea"] },
  claims: { x: 854, y: 418, w: 116, h: 56, lines: ["Claims &", "eligibility APIs"] },
  calc: { x: 978, y: 418, w: 120, h: 56, lines: ["Calculators"], sub: ["code maps"] },
  tests: { x: 22, y: 540, w: 200, h: 56, lines: ["Labeled test sets"], sub: ["per application"] },
  evals: { x: 240, y: 540, w: 200, h: 56, lines: ["Evals in CI"], sub: ["block on regression"], keyControl: true },
  tracing: { x: 458, y: 540, w: 200, h: 56, lines: ["Tracing"], sub: ["latency · cost per case"] },
  audit: { x: 676, y: 540, w: 200, h: 56, lines: ["Audit log"], sub: ["inputs, outputs, decisions"] },
  risk: { x: 894, y: 540, w: 204, h: 56, lines: ["Model risk review"], sub: ["drift · re-labeling"] },
};

// kind: req = request going in, ret = result coming back, log = logging.
const LINKS: { d: string; kind: "req" | "ret" | "log"; arrow?: boolean }[] = [
  { d: "M200,98 H225", kind: "req" },
  { d: "M200,165 H225", kind: "req" },
  { d: "M200,229 H225", kind: "req" },
  { d: "M200,293 H225", kind: "req" },
  { d: "M225,293 V100", kind: "req" },
  { d: "M225,100 H250", kind: "req", arrow: true },
  { d: "M340,130 V165", kind: "req", arrow: true },
  { d: "M430,190 H455 V135 H480", kind: "req", arrow: true },
  { d: "M340,215 V250", kind: "req" },
  { d: "M700,365 V405", kind: "req" },
  { d: "M700,405 H540", kind: "req" },
  { d: "M700,405 H1038", kind: "req" },
  ...[540, 664, 788, 912, 1038].map((x) => ({ d: `M${x},405 V418`, kind: "req" as const, arrow: true })),
  { d: "M760,105 H820", kind: "req", arrow: true },
  { d: "M760,188 H820", kind: "req", arrow: true },
  { d: "M810,245 H760", kind: "ret", arrow: true },
  { d: "M620,270 V290", kind: "req", arrow: true },
  { d: "M480,315 H455 V350 H110 V318", kind: "ret", arrow: true },
  { d: "M340,365 V518", kind: "log", arrow: true },
];

const BADGES: Pt[] = [[225, 196], [340, 147], [455, 163], [700, 385], [790, 105], [786, 245], [640, 280], [290, 350], [340, 452]];

// The route the request dot travels in each step, and the boxes lit meanwhile.
const ROUTES: { pts: Pt[]; lit: BoxId[] }[] = [
  { pts: [[110, 98], [200, 98], [225, 98], [225, 100], [250, 100]], lit: ["inbound", "gateway"] },
  { pts: [[340, 100], [340, 130], [340, 165]], lit: ["gateway", "redact"] },
  { pts: [[340, 190], [430, 190], [455, 190], [455, 135], [480, 135]], lit: ["redact", "inject", "workflows"] },
  { pts: [[700, 365], [700, 405], [540, 405], [540, 418]], lit: ["workflows", "policy", "search", "fhir", "claims", "calc"] },
  { pts: [[700, 105], [760, 105], [820, 105]], lit: ["workflows", "claude", "ml"] },
  { pts: [[820, 245], [810, 245], [760, 245]], lit: ["claude", "checks"] },
  { pts: [[620, 245], [620, 270], [620, 290]], lit: ["checks", "human"] },
  { pts: [[480, 315], [455, 315], [455, 350], [110, 350], [110, 318]], lit: ["human", "reviewer"] },
  { pts: [[340, 365], [340, 518]], lit: ["tracing", "audit", "evals"] },
];

const STEP_MS = 1600;
const MOVE_MS = 1000;
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

function pointAt(pts: Pt[], t: number): Pt {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = t * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    }
    d -= lens[i];
  }
  return pts[pts.length - 1];
}

export function ArchitectureDiagram() {
  const [step, setStep] = useState(0);
  const [dot, setDot] = useState<Pt>(ROUTES[0].pts[0]);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const elapsed = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!playing || reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Clamp the delta: the first rAF timestamp can precede `last`, and a tab
      // returning from the background shouldn't skip steps.
      elapsed.current += Math.max(0, Math.min(now - last, 100));
      last = now;
      const total = STEP_MS * ROUTES.length;
      const e = elapsed.current % total;
      const s = Math.floor(e / STEP_MS);
      setStep(s);
      setDot(pointAt(ROUTES[s].pts, ease(Math.min(1, (e - s * STEP_MS) / MOVE_MS))));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduced]);

  const animating = playing && !reduced;
  const lit = new Set(reduced ? [] : ROUTES[step].lit);

  return (
    <div className="arch-block">
      <div className="arch-wrap">
        <svg
          viewBox="0 0 1120 620"
          className={reduced ? "arch-svg arch-still" : animating ? "arch-svg arch-anim" : "arch-svg arch-anim arch-paused"}
          role="img"
          aria-labelledby="arch-title arch-desc"
        >
          <title id="arch-title">Healthcare payer AI platform architecture</title>
          <desc id="arch-desc">
            Requests flow from channels through an edge layer (gateway, redaction, injection screening) into use-case
            workflows, which call knowledge sources, tools and models. Code checks citations and routes cases to a human
            review queue. A quality and operations layer logs and evaluates every step.
          </desc>
          <defs>
            {(["req", "ret", "log"] as const).map((k) => (
              <marker key={k} id={`arch-ah-${k}`} viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0,0 L8,4 L0,8 z" className={`arch-ah arch-ah-${k}`} />
              </marker>
            ))}
          </defs>

          <Frame x={10} y={45} w={200} h={320} title="CHANNELS" />
          <Frame x={240} y={45} w={200} h={320} title="EDGE" />
          <Frame x={470} y={45} w={300} h={320} title="ORCHESTRATION" />
          <Frame x={810} y={45} w={300} h={320} title="MODELS" />
          <Frame x={470} y={392} w={640} h={96} title="KNOWLEDGE & TOOLS" />
          <Frame x={10} y={518} w={1100} h={92} title="QUALITY & OPERATIONS" />

          {(Object.keys(BOXES) as BoxId[]).map((id) => (
            <Box key={id} {...BOXES[id]} lit={lit.has(id)} />
          ))}

          {LINKS.map((l) => (
            <path
              key={l.d}
              d={l.d}
              className={`arch-line arch-${l.kind}`}
              markerEnd={l.arrow ? `url(#arch-ah-${l.kind})` : undefined}
            />
          ))}

          {BADGES.map(([x, y], i) => {
            const on = !reduced && i === step;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={on ? 13 : 10} className={on ? "arch-step arch-step-on" : "arch-step"} />
                <text x={x} y={y + 4} textAnchor="middle" className={on ? "arch-step-n arch-step-n-on" : "arch-step-n"}>
                  {i + 1}
                </text>
              </g>
            );
          })}

          {!reduced && (
            <g aria-hidden="true">
              <circle cx={dot[0]} cy={dot[1]} r={13} className="arch-dot-halo" />
              <circle cx={dot[0]} cy={dot[1]} r={6.5} className="arch-dot" />
            </g>
          )}
        </svg>
      </div>
      {!reduced && (
        <div className="arch-caption">
          <span className="arch-caption-n" aria-hidden="true">
            {step + 1}
          </span>
          <span className="arch-caption-text" aria-live="off">
            {FLOW_STEPS[step]}
          </span>
          <button type="button" className="btn ghost arch-toggle" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </button>
        </div>
      )}
    </div>
  );
}
