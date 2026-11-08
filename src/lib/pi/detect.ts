import data from "../../../data/pi/providers.json";
import type { FeatureResult, Lead, PeerPoint, Provider, Screen, Tier } from "./types";

// The detection step. Plain statistics, with no model involved: robust peer-group z-scores
// (median and MAD, so outliers don't hide themselves), risk adjustment for the 99215 share, and
// one hard rule for implausible billed hours.

const FLAG_Z = 3.5;
const HIGH_Z = 8;
const Z_CAP = 12;
const IMPLAUSIBLE_HOURS = 16;

// Illustrative unit values, used only to size a lead.
const LEVEL5_PREMIUM = 55; // 99215 allowed minus 99214 allowed
const MODIFIER25_EM = 110; // E/M paid alongside a same-day procedure
const THERAPY_UNIT = 28;
const THERAPY_VISIT = 95;

type Format = "pct" | "num1" | "num2" | "hours" | "usd";

interface FeatureDef {
  id: string;
  label: string;
  value: (p: Provider) => number;
  format: Format;
  /** Estimated billing above the peer pattern, given the excess over the reference value. */
  exposure?: (p: Provider, excess: number) => number;
  hardRule?: (value: number) => boolean;
}

const peakDay: FeatureDef = {
  id: "peak_day_hours",
  label: "Busiest day, billed time implied by codes",
  value: (p) => p.peakDayHours,
  format: "hours",
  hardRule: (v) => v > IMPLAUSIBLE_HOURS,
};

const FEATURES: Record<Provider["specialty"], FeatureDef[]> = {
  "Family Medicine": [
    {
      id: "level5_share",
      label: "Established visits billed at 99215",
      value: (p) => p.level5Share!,
      format: "pct",
      exposure: (p, x) => x * p.encounters * LEVEL5_PREMIUM,
    },
    {
      id: "modifier25_rate",
      label: "Visits billed with modifier 25",
      value: (p) => p.modifier25Rate!,
      format: "pct",
      exposure: (p, x) => x * p.encounters * MODIFIER25_EM,
    },
    peakDay,
    { id: "allowed_per_patient", label: "Allowed amount per patient", value: (p) => p.allowedPerPatient!, format: "usd" },
  ],
  "Physical Therapy": [
    {
      id: "units_per_visit",
      label: "Timed units per visit",
      value: (p) => p.unitsPerVisit!,
      format: "num2",
      exposure: (p, x) => x * p.encounters * THERAPY_UNIT,
    },
    { id: "four_plus_unit_share", label: "Visits with 4 or more timed units", value: (p) => p.fourPlusUnitShare!, format: "pct" },
    {
      id: "visits_per_patient",
      label: "Visits per patient",
      value: (p) => p.visitsPerPatient!,
      format: "num1",
      exposure: (p, x) => x * (p.patients ?? 0) * THERAPY_VISIT,
    },
    { id: "modifier59_rate", label: "Visits billed with modifier 59", value: (p) => p.modifier59Rate!, format: "pct" },
    peakDay,
  ],
};

export function formatValue(v: number, f: Format): string {
  switch (f) {
    case "pct":
      return `${(v * 100).toFixed(1)}%`;
    case "num1":
      return v.toFixed(1);
    case "num2":
      return v.toFixed(2);
    case "hours":
      return `${v.toFixed(1)} hours`;
    case "usd":
      return `$${Math.round(v).toLocaleString("en-US")}`;
  }
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Robust z-score: 0.6745 x (x - median) / MAD. */
export function robustZ(x: number, med: number, mad: number): number {
  return mad === 0 ? 0 : (0.6745 * (x - med)) / mad;
}

/** Theil-Sen line: the median of all pairwise slopes, so outliers can't tilt it. */
export function theilSen(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  const slope = median(slopes);
  const intercept = median(ys.map((y, i) => y - slope * xs[i]));
  return { slope, intercept };
}

const round = (x: number, d: number) => Number(x.toFixed(d));

export function runScreen(period: string, providers: Provider[]): Screen {
  const peers: Screen["peers"] = {};
  const all: Lead[] = [];
  let level5Line = { slope: 0, intercept: 0 };

  for (const specialty of Object.keys(FEATURES) as Provider["specialty"][]) {
    const group = providers.filter((p) => p.specialty === specialty);
    peers[specialty] = {};
    const stats = FEATURES[specialty].map((def) => {
      const values = group.map((p) => def.value(p));
      const med = median(values);
      const mad = median(values.map((v) => Math.abs(v - med)));
      peers[specialty][def.id] = group.map((p) => ({ id: p.id, value: def.value(p), risk: p.patientRiskScore } satisfies PeerPoint));

      if (def.id !== "level5_share") return { def, med, mad, line: null, residMed: 0, residMad: 0 };
      // Sicker panels justify more high-level visits, so judge this feature on its residual.
      const risks = group.map((p) => p.patientRiskScore!);
      const line = theilSen(risks, values);
      level5Line = line;
      const resid = group.map((p) => def.value(p) - (line.intercept + line.slope * p.patientRiskScore!));
      const residMed = median(resid);
      const residMad = median(resid.map((r) => Math.abs(r - residMed)));
      return { def, med, mad, line, residMed, residMad };
    });

    for (const p of group) {
      let exposure = 0;
      const features: FeatureResult[] = stats.map(({ def, med, mad, line, residMed, residMad }) => {
        const value = def.value(p);
        const rawZ = robustZ(value, med, mad);
        const expected = line ? line.intercept + line.slope * p.patientRiskScore! : null;
        const z = line ? robustZ(value - expected!, residMed, residMad) : rawZ;
        const hardRule = def.hardRule?.(value) ?? false;
        const flagged = z >= FLAG_Z || hardRule;
        if (flagged && def.exposure) exposure += Math.max(0, def.exposure(p, value - (expected ?? med)));
        return {
          id: def.id,
          label: def.label,
          value,
          display: formatValue(value, def.format),
          peerMedian: med,
          peerDisplay: formatValue(med, def.format),
          expected,
          expectedDisplay: expected === null ? null : formatValue(expected, def.format),
          z: round(z, 1),
          rawZ: round(rawZ, 1),
          flagged,
          hardRule,
        };
      });

      const flags = features.filter((f) => f.flagged);
      const sum = flags.reduce((a, f) => a + Math.min(f.z, Z_CAP), 0);
      const tier: Tier =
        flags.length === 0 ? "none" : flags.some((f) => f.hardRule || f.z >= HIGH_Z) || flags.length >= 2 ? "high" : "medium";
      all.push({
        providerId: p.id,
        specialty,
        encounters: p.encounters,
        tier,
        score: flags.length ? Math.round(100 * (1 - Math.exp(-sum / 15))) : 0,
        features,
        flaggedLabels: flags.map((f) => f.label),
        exposure: Math.round(exposure / 100) * 100,
        clearedByAdjustment: features.some((f) => f.expected !== null && f.rawZ >= FLAG_Z && f.z < FLAG_Z),
      });
    }
  }

  return {
    period,
    cohortSize: providers.length,
    leads: all.filter((l) => l.tier !== "none").sort((a, b) => b.score - a.score || b.exposure - a.exposure),
    cleared: all.filter((l) => l.tier === "none" && l.clearedByAdjustment),
    peers,
    level5Line,
  };
}

export const SCREEN = runScreen(data.period, data.providers as Provider[]);
export const findLead = (id: string) => SCREEN.leads.find((l) => l.providerId === id);
