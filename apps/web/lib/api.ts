import type { AdType, AnalysisResponse } from "@/lib/types";

export type AnalyzeInput = {
  file: File;
  adType: AdType;
  campaignGoal?: string;
  audience?: string;
  brandName?: string;
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8010";
}

export async function analyzeCreative(input: AnalyzeInput): Promise<AnalysisResponse> {
  const fd = new FormData();
  fd.set("file", input.file);
  fd.set("adType", input.adType);
  if (input.campaignGoal) fd.set("campaignGoal", input.campaignGoal);
  if (input.audience) fd.set("audience", input.audience);
  if (input.brandName) fd.set("brandName", input.brandName);

  const res = await fetch(`${apiBase()}/analyze`, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Analyze failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as AnalysisResponse;
}

