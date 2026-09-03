import type { AdType, AnalysisResponse } from "@/lib/types";
import { analyzeLocally } from "@/lib/heuristics";
import { normalizeApiBase } from "@/lib/api-config";

export type AnalyzeInput = {
  file: File;
  adType: AdType;
  campaignGoal?: string;
  audience?: string;
  brandName?: string;
};

export type AnalysisSource = "remote" | "local";

export type AnalyzeOutcome = {
  result: AnalysisResponse;
  source: AnalysisSource;
  // true when we attempted the remote backend but had to fall back to local heuristics
  fellBack: boolean;
  // explanation when fellBack is true — shown discreetly in the UI
  fallbackReason?: string;
};

class RemoteAnalyzeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RemoteAnalyzeError";
  }
}

function apiBase(): string | null {
  // Explicitly blank values disable the backend and force local heuristic mode.
  return normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);
}

/** Tells the UI whether a remote call would be attempted at all. */
export function isRemoteConfigured(): boolean {
  return apiBase() !== null;
}

async function tryRemote(base: string, input: AnalyzeInput): Promise<AnalysisResponse> {
  const fd = new FormData();
  fd.set("file", input.file);
  fd.set("adType", input.adType);
  if (input.campaignGoal) fd.set("campaignGoal", input.campaignGoal);
  if (input.audience) fd.set("audience", input.audience);
  if (input.brandName) fd.set("brandName", input.brandName);

  // 30s timeout — enough for Gemini (typically 4-8s) plus cold-start on Render (~25s).
  // Falls back to local heuristics only if the server is genuinely unreachable.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${base}/analyze`, { method: "POST", body: fd, signal: ctrl.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new RemoteAnalyzeError(
        res.status,
        `Analyze failed (${res.status}): ${text || res.statusText}`,
      );
    }
    return (await res.json()) as AnalysisResponse;
  } finally {
    clearTimeout(t);
  }
}

export async function analyzeCreative(input: AnalyzeInput): Promise<AnalyzeOutcome> {
  const base = apiBase();
  if (base) {
    try {
      const result = await tryRemote(base, input);
      return { result, source: "remote", fellBack: false };
    } catch (err) {
      // Invalid uploads and other client errors need to reach the user. Running
      // the same rejected input through local heuristics can hide backend size
      // or image-validation failures and produce a misleading "successful"
      // analysis. Availability errors and rate limits may still fall back.
      if (
        err instanceof RemoteAnalyzeError &&
        err.status >= 400 &&
        err.status < 500 &&
        err.status !== 408 &&
        err.status !== 429
      ) {
        throw err;
      }
      const reason = err instanceof Error ? err.message : "Unknown error";
      const result = await analyzeLocally(input.file, input.adType);
      return { result, source: "local", fellBack: true, fallbackReason: reason };
    }
  }
  const result = await analyzeLocally(input.file, input.adType);
  return { result, source: "local", fellBack: false };
}
