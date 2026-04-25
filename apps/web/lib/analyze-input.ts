import type { AdType } from "@/lib/types";

export type AnalyzeInput = {
  file: File;
  adType: AdType;
  campaignGoal?: string;
  audience?: string;
  brandName?: string;
};
