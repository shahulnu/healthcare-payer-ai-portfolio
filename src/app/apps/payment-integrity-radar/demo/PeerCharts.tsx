"use client";

import { useState } from "react";
import type { FeatureResult, PeerPoint } from "@/lib/pi/types";

// Peer charts. Peers are neutral context, and the selected provider is the one highlighted mark:
// larger, ringed and directly labeled, so identity never depends on color alone.

interface Tip {
  x: number;
  y: number;
  text: string;
}

const W = 480;

/** Evenly spread vertical offsets so overlapping peers stay visible. Repeatable, so no jitter on re-render. */
const lane = (i: number, height: number) => ((i * 7) % 5) * (height / 4) - height / 2;

function ChartTip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  const leftPct = (tip.x / W) * 100;
  return (
    <div className="chart-tip" style={{ left: `${Math.min(78, Math.max(0, leftPct))}%`, top: tip.y }}>
      {tip.text}
    </div>
  );
}

function fmt(value: number, f: FeatureResult) {
  if (f.display.endsWith("%")) return `${(value * 100).toFixed(1)}%`;
  if (f.display.endsWith("hours")) return `${value.toFixed(1)} hours`;
  if (f.display.startsWith("$")) return `$${Math.round(value).toLocaleString("en-US")}`;
  return value.toFixed(f.display.split(".")[1]?.length ?? 1);
}

export function StripPlot({ feature, points, providerId }: { feature: FeatureResult; points: PeerPoint[]; providerId: string }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const H = 62;
  const pad = 12;
  const mid = 34;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (v: number) => pad + ((v - lo) / (hi - lo || 1)) * (W - pad * 2);
  const focusX = x(feature.value);
  const medX = x(feature.peerMedian);
  const labelAnchor = focusX > W * 0.75 ? "end" : focusX < W * 0.25 ? "start" : "middle";

  return (
    <div className="chart-box" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`${feature.label}: this provider ${feature.display}, peer median ${feature.peerDisplay}`}>
        <line x1={pad} x2={W - pad} y1={mid} y2={mid} className="chart-axis" />
        <line x1={medX} x2={medX} y1={mid - 12} y2={mid + 12} className="chart-median" />
        {points
          .filter((p) => p.id !== providerId)
          .map((p, i) => {
            const cx = x(p.value);
            const cy = mid + lane(i, 12);
            return (
              <g key={p.id}>
                <circle cx={cx} cy={cy} r={3} className="chart-peer" />
                <circle cx={cx} cy={cy} r={7} fill="transparent" onMouseEnter={() => setTip({ x: cx, y: 2, text: `${p.id}: ${fmt(p.value, feature)}` })} />
              </g>
            );
          })}
        <circle cx={focusX} cy={mid} r={6.5} className="chart-focus" />
        <text x={focusX} y={14} textAnchor={labelAnchor} className="chart-label">
          {feature.display}
        </text>
        <circle cx={focusX} cy={mid} r={10} fill="transparent" onMouseEnter={() => setTip({ x: focusX, y: 2, text: `${providerId}: ${feature.display}` })} />
      </svg>
      <ChartTip tip={tip} />
    </div>
  );
}

/** The 99215 share against patient risk. Shows why a raw outlier can be cleared and a real one isn't. */
export function RiskScatter({
  points,
  providerId,
  clearedIds,
  line,
}: {
  points: PeerPoint[];
  providerId: string;
  clearedIds: string[];
  line: { slope: number; intercept: number };
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const H = 250;
  const m = { l: 44, r: 12, t: 12, b: 36 };
  const xMin = 0.6;
  const xMax = 2.3;
  const yMax = Math.ceil(Math.max(...points.map((p) => p.value)) * 10 + 0.5) / 10;
  const px = (r: number) => m.l + ((r - xMin) / (xMax - xMin)) * (W - m.l - m.r);
  const py = (v: number) => H - m.b - (v / yMax) * (H - m.t - m.b);
  const yTicks = Array.from({ length: Math.round(yMax / 0.1) + 1 }, (_, i) => i * 0.1);
  const focus = points.find((p) => p.id === providerId);
  const cleared = points.filter((p) => clearedIds.includes(p.id));

  return (
    <div className="chart-box" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Share of visits billed at 99215 against average patient risk score, for Family Medicine peers, with the expected line.">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={py(t)} y2={py(t)} className="chart-grid" />
            <text x={m.l - 6} y={py(t) + 4} textAnchor="end" className="chart-tick">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {[0.75, 1, 1.25, 1.5, 1.75, 2, 2.25].map((t) => (
          <text key={t} x={px(t)} y={H - m.b + 16} textAnchor="middle" className="chart-tick">
            {t.toFixed(2)}
          </text>
        ))}
        <text x={(m.l + W - m.r) / 2} y={H - 8} textAnchor="middle" className="chart-tick">
          Average patient risk score
        </text>
        <line x1={px(xMin)} y1={py(line.intercept + line.slope * xMin)} x2={px(xMax)} y2={py(line.intercept + line.slope * xMax)} className="chart-line" />
        {points
          .filter((p) => p.id !== providerId && !clearedIds.includes(p.id))
          .map((p) => (
            <g key={p.id}>
              <circle cx={px(p.risk!)} cy={py(p.value)} r={3} className="chart-peer" />
              <circle
                cx={px(p.risk!)}
                cy={py(p.value)}
                r={7}
                fill="transparent"
                onMouseEnter={() => setTip({ x: px(p.risk!), y: py(p.value) - 30, text: `${p.id}: ${(p.value * 100).toFixed(1)}%, risk ${p.risk!.toFixed(2)}` })}
              />
            </g>
          ))}
        {cleared.map((p) => (
          <g key={p.id}>
            <circle cx={px(p.risk!)} cy={py(p.value)} r={5.5} className="chart-cleared" />
            <text x={px(p.risk!)} y={py(p.value) - 10} textAnchor="end" className="chart-tick">
              {p.id}: cleared by risk adjustment
            </text>
          </g>
        ))}
        {focus && (
          <g>
            <circle cx={px(focus.risk!)} cy={py(focus.value)} r={6.5} className="chart-focus" />
            <text x={px(focus.risk!) + 11} y={py(focus.value) + 4} className="chart-label">
              {(focus.value * 100).toFixed(1)}%
            </text>
          </g>
        )}
      </svg>
      <ChartTip tip={tip} />
    </div>
  );
}
