import type { CategoryScores } from "@/lib/types";

// Human-readable labels for the six scored categories, keyed by the camelCase
// identifiers used across the API, the schema, and the local heuristics.
export const CATEGORY_LABELS: Record<keyof CategoryScores, string> = {
  visualHierarchy: "Visual hierarchy",
  ctaProminence: "CTA prominence",
  copyClarity: "Copy clarity",
  readability: "Readability",
  layoutBalance: "Layout balance",
  trustSignals: "Trust signals",
};

// Issue/recommendation `category` values are free strings (an LLM can emit
// anything), so an unknown category is returned verbatim rather than rendering
// a raw camelCase identifier like "ctaProminence" to the user.
export function categoryLabel(category: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[category] ?? category;
}
