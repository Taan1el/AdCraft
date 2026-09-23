// Persistence helpers. Writes/reads ad analyses + uploads images to Supabase
// Storage. Every function no-ops gracefully if Supabase isn't configured —
// keeps the anonymous heuristic flow working when the user is logged out.
import type { AnalysisResponse, AdType } from "@adcraft/shared-types";
import { getSupabase } from "@/lib/supabase";
import { imageExtension } from "@/lib/utils";
import type { AnalysisRow } from "@/lib/aggregates";

// Aggregate helpers live in a Supabase-free module so they can be unit-tested
// directly; re-export them here so "@/lib/history" stays the single import site.
export { computeAggregates } from "@/lib/aggregates";
export type { AnalysisRow, Aggregates } from "@/lib/aggregates";

const BUCKET = "ads";
const HISTORY_LIMIT = 10;

export async function saveAnalysis(opts: {
  file: File;
  adType: AdType;
  result: AnalysisResponse;
  source: "local" | "remote";
}): Promise<{ saved: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { saved: false };
  const { data: u } = await sb.auth.getUser();
  const userId = u.user?.id;
  if (!userId) return { saved: false };

  // Object key is namespaced by user id — RLS policy keys off the first folder.
  const ext = imageExtension(opts.file.name);
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
  if (ins.error) {
    try {
      await sb.storage.from(BUCKET).remove([key]);
    } catch {
      // Preserve the database error even if best-effort orphan cleanup fails.
    }
    return { saved: false, error: ins.error.message };
  }
  return { saved: true };
}

export async function listAnalyses(): Promise<AnalysisRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
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

