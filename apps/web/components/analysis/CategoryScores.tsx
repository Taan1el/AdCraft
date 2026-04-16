"use client";

import type { CategoryScores as TCategoryScores } from "@/lib/types";
import { ScoreCard } from "./ScoreCard";

export function CategoryScores({ scores }: { scores: TCategoryScores }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <ScoreCard label="Visual hierarchy" score={scores.visualHierarchy} />
      <ScoreCard label="CTA prominence" score={scores.ctaProminence} />
      <ScoreCard label="Copy clarity" score={scores.copyClarity} />
      <ScoreCard label="Readability" score={scores.readability} />
      <ScoreCard label="Layout balance" score={scores.layoutBalance} />
      <ScoreCard label="Trust signals" score={scores.trustSignals} />
    </div>
  );
}

