// Dashboard aggregate stats over a set of stored analyses.
//
// This module is deliberately free of the Supabase client (and the "@/…" path
// alias that pulls it in) so the pure reducer below can be unit-tested directly
// under Node's native TypeScript execution, the same way the heuristics suite
// tests lib/heuristics.ts. lib/history.ts re-exports these names, so existing
// "@/lib/history" importers are unaffected.
import type { AnalysisResponse, AdType } from "@adcraft/shared-types";

export type AnalysisRow = {
  id: string;
  created_at: string;
  file_name: string | null;
  image_path: string | null;
  ad_type: AdType;
  overall: number;
  scores: AnalysisResponse["categoryScores"];
  metrics: AnalysisResponse["metrics"];
  summary: string | null;
  source: "local" | "remote" | "gemini";
  signedImageUrl?: string;
};

export type Aggregates = {
  count: number;
  averageOverall: number;
  best: AnalysisRow | null;
  worst: AnalysisRow | null;
  averagesByCategory: Record<keyof AnalysisResponse["categoryScores"], number>;
};

const CATEGORY_KEYS: (keyof AnalysisResponse["categoryScores"])[] = [
  "visualHierarchy", "ctaProminence", "copyClarity", "readability", "layoutBalance", "trustSignals",
];

// A score read back from storage is typed `number`, but a partial write or a
// schema drift can hand us `null`/`undefined`/`NaN` at runtime. `x ?? 0` misses
// NaN, and a single such value poisons every downstream sum: `total + NaN` is
// NaN and `Math.round(NaN)` renders as the literal "NaN" in the dashboard Stat
// tiles. Coerce any non-finite value to 0, mirroring lib/utils.ts formatPct01,
// so one malformed row degrades gracefully instead of blanking the panel.
function finite(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

export function computeAggregates(rows: AnalysisRow[]): Aggregates {
  const empty: Aggregates = {
    count: 0, averageOverall: 0, best: null, worst: null,
    averagesByCategory: {
      visualHierarchy: 0, ctaProminence: 0, copyClarity: 0,
      readability: 0, layoutBalance: 0, trustSignals: 0,
    },
  };
  if (rows.length === 0) return empty;

  let best = rows[0];
  let worst = rows[0];
  let sumOverall = 0;
  const sumByCat: Record<string, number> = {};
  for (const c of CATEGORY_KEYS) sumByCat[c] = 0;

  for (const r of rows) {
    const overall = finite(r.overall);
    sumOverall += overall;
    if (overall > finite(best.overall)) best = r;
    if (overall < finite(worst.overall)) worst = r;
    for (const c of CATEGORY_KEYS) sumByCat[c] += finite(r.scores?.[c]);
  }
  const avgByCat = {} as Aggregates["averagesByCategory"];
  for (const c of CATEGORY_KEYS) avgByCat[c] = Math.round(sumByCat[c] / rows.length);

  return {
    count: rows.length,
    averageOverall: Math.round(sumOverall / rows.length),
    best,
    worst,
    averagesByCategory: avgByCat,
  };
}
