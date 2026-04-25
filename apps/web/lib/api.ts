import type { AdType, AnalysisResponse } from "@/lib/types";
import { analyzeLocally } from "@/lib/heuristics";

export type AnalyzeInput = {
  file: File;
  adType: AdType;
  campaignGoal?: string;
  audience?: string;
  brandName?: string;
};

function apiBase(): string | null {
  // explicit empty string disables the backend and forces local heuristic mode
  const v = process.env.NEXT_PUBLIC_API_URL;
  if (v === "") return null;
  return v || "http://127.0.0.1:8010";
}

async function tryRemote(base: string, input: AnalyzeInput): Promise<AnalysisResponse> {
  const fd = new FormData();
  fd.set("file", input.file);
  fd.set("adType", input.adType);
  if (input.campaignGoal) fd.set("campaignGoal", input.campaignGoal);
  if (input.audience) fd.set("audience", input.audience);
  if (input.brandName) fd.set("brandName", input.brandName);

  // short timeout — if the API isn't reachable we fall back to local rather than hang
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`${base}/analyze`, { method: "POST", body: fd, signal: ctrl.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Analyze failed (${res.status}): ${text || res.statusText}`);
    }
    return (await res.json()) as AnalysisResponse;
  } finally {
    clearTimeout(t);
  }
}

export async function analyzeCreative(input: AnalyzeInput): Promise<AnalysisResponse> {
  const base = apiBase();
  if (base) {
    try {
      return await tryRemote(base, input);
    } catch {
      // backend unreachable or errored — drop to local engine
    }
  }
  return analyzeLocally(input.file, input.adType);
}
