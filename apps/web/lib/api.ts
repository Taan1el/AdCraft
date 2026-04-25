import type { AnalyzeInput } from "@/lib/analyze-input";
import { analyzeWithHeuristics } from "@/lib/heuristics";
import type { AnalysisResponse } from "@/lib/types";

export type { AnalyzeInput };

const LOCAL_DEADLINE_MS = 8000;

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8010").replace(/\/$/, "");
}

export async function analyzeCreative(input: AnalyzeInput): Promise<AnalysisResponse> {
  const fd = new FormData();
  fd.set("file", input.file);
  fd.set("adType", input.adType);
  if (input.campaignGoal) fd.set("campaignGoal", input.campaignGoal);
  if (input.audience) fd.set("audience", input.audience);
  if (input.brandName) fd.set("brandName", input.brandName);

  const endpoint = `${apiBase()}/analyze`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LOCAL_DEADLINE_MS);
  try {
    const response = await fetch(endpoint, { method: "POST", body: fd, signal: ctrl.signal });
    if (response.ok) {
      try {
        return (await response.json()) as AnalysisResponse;
      } catch {
        return analyzeWithHeuristics(input);
      }
    }
  } catch {
    // offline, CORS, DNS, timeout, etc.
  } finally {
    clearTimeout(timer);
  }

  return analyzeWithHeuristics(input);
}
