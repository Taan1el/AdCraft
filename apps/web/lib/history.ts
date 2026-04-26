// Persistence helpers. Writes/reads ad analyses + uploads images to Supabase
// Storage. Every function no-ops gracefully if Supabase isn't configured —
// keeps the anonymous heuristic flow working when the user is logged out.
import type { AnalysisResponse, AdType } from "@adcraft/shared-types";
import { getSupabase } from "@/lib/supabase";

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
  source: "local" | "gemini";
  signedImageUrl?: string;
};

const BUCKET = "ads";

export async function saveAnalysis(opts: {
  file: File;
  adType: AdType;
  result: AnalysisResponse;
  source: "local" | "gemini";
}): Promise<{ saved: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { saved: false };
  const { data: u } = await sb.auth.getUser();
  const userId = u.user?.id;
  if (!userId) return { saved: false };

  // Object key is namespaced by user id — RLS policy keys off the first folder.
  const ext = (opts.file.name.split(".").pop() || "png").toLowerCase();
  const key = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const up = await sb.storage.from(BUCKET).upload(key, opts.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: opts.file.type || "image/png",
  });
  if (up.error) return { saved: false, error: up.error.message };

  const ins = await sb.from("analyses").insert({
    user_id: userId,
    file_name: opts.file.name,
    image_path: key,
    ad_type: opts.adType,
    overall: opts.result.overallScore,
    scores: opts.result.categoryScores,
    metrics: opts.result.metrics,
    summary: opts.result.summary,
    source: opts.source,
  });
  if (ins.error) return { saved: false, error: ins.error.message };
  return { saved: true };
}

export async function listAnalyses(): Promise<AnalysisRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];

  const rows = data as AnalysisRow[];
  // Sign each image URL (bucket is private). 1 hour is plenty for a page view.
  await Promise.all(rows.map(async (r) => {
    if (!r.image_path) return;
    const { data: s } = await sb.storage.from(BUCKET).createSignedUrl(r.image_path, 3600);
    if (s) r.signedImageUrl = s.signedUrl;
  }));
  return rows;
}

export async function deleteAnalysis(row: AnalysisRow): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  if (row.image_path) await sb.storage.from(BUCKET).remove([row.image_path]);
  await sb.from("analyses").delete().eq("id", row.id);
}

export type Aggregates = {
  count: number;
  averageOverall: number;
  best: AnalysisRow | null;
  worst: AnalysisRow | null;
  averagesByCategory: Record<keyof AnalysisResponse["categoryScores"], number>;
};

export function computeAggregates(rows: AnalysisRow[]): Aggregates {
  const cats: (keyof AnalysisResponse["categoryScores"])[] = [
    "visualHierarchy", "ctaProminence", "copyClarity", "readability", "layoutBalance", "trustSignals",
  ];
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
  for (const c of cats) sumByCat[c] = 0;

  for (const r of rows) {
    sumOverall += r.overall;
    if (r.overall > best.overall) best = r;
    if (r.overall < worst.overall) worst = r;
    for (const c of cats) sumByCat[c] += r.scores[c] ?? 0;
  }
  const avgByCat = {} as Aggregates["averagesByCategory"];
  for (const c of cats) avgByCat[c] = Math.round(sumByCat[c] / rows.length);

  return {
    count: rows.length,
    averageOverall: Math.round(sumOverall / rows.length),
    best,
    worst,
    averagesByCategory: avgByCat,
  };
}
