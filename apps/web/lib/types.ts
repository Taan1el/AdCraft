export type AdType =
  | "display_ad"
  | "landing_hero"
  | "email_hero"
  | "social_ad";

export interface CategoryScores {
  visualHierarchy: number;
  ctaProminence: number;
  copyClarity: number;
  readability: number;
  layoutBalance: number;
  trustSignals: number;
}

export interface Issue {
  id: string;
  category: keyof CategoryScores;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
}

export interface Recommendation {
  id: string;
  category: keyof CategoryScores;
  priority: "low" | "medium" | "high";
  title: string;
  action: string;
}

export interface Annotation {
  id: string;
  type: "box";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VisualMetrics {
  whitespaceRatio: number;
  visualDensity: number;
  contrastScore: number;
  ctaSaliencyScore: number;
}

export interface AnalysisResponse {
  analysisId: string;
  image: {
    width: number;
    height: number;
  };
  overallScore: number;
  summary: string;
  categoryScores: CategoryScores;
  issues: Issue[];
  recommendations: Recommendation[];
  annotations: Annotation[];
  metrics: VisualMetrics;
}

export interface AnalyzeCreativeInput {
  file: File;
  adType: AdType;
  campaignGoal?: string;
  audience?: string;
  brandName?: string;
}
