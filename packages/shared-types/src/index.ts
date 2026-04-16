export type AdType = "display_ad" | "landing_hero" | "email_hero" | "social_ad";

export type ScoreCategory =
  | "visualHierarchy"
  | "ctaProminence"
  | "copyClarity"
  | "readability"
  | "layoutBalance"
  | "trustSignals";

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
  category: ScoreCategory | string;
  severity: "low" | "medium" | "high" | string;
  title: string;
  description: string;
}

export interface Recommendation {
  id: string;
  category: ScoreCategory | string;
  priority: "low" | "medium" | "high" | string;
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

export interface AnalysisResponse {
  analysisId: string;
  image: { width: number; height: number };
  overallScore: number;
  summary: string;
  categoryScores: CategoryScores;
  issues: Issue[];
  recommendations: Recommendation[];
  annotations: Annotation[];
  metrics: {
    whitespaceRatio: number;
    visualDensity: number;
    contrastScore: number;
    ctaSaliencyScore: number;
  };
}

