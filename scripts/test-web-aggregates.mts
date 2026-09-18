import assert from "node:assert/strict";

import { computeAggregates, type AnalysisRow } from "../apps/web/lib/aggregates.ts";

// A minimal well-formed row; individual tests override the fields they probe.
function row(overrides: Partial<AnalysisRow>): AnalysisRow {
  return {
    id: "id",
    created_at: "2024-01-01T00:00:00Z",
    file_name: null,
    image_path: null,
    ad_type: "display_ad",
    overall: 0,
    scores: {
      visualHierarchy: 0,
      ctaProminence: 0,
      copyClarity: 0,
      readability: 0,
      layoutBalance: 0,
      trustSignals: 0,
    },
    metrics: {
      whitespaceRatio: 0,
      visualDensity: 0,
      contrastScore: 0,
      ctaSaliencyScore: 0,
    },
    summary: null,
    source: "local",
    ...overrides,
  };
}

// Empty input returns the zeroed shape with no best/worst.
{
  const agg = computeAggregates([]);
  assert.equal(agg.count, 0);
  assert.equal(agg.averageOverall, 0);
  assert.equal(agg.best, null);
  assert.equal(agg.worst, null);
  for (const v of Object.values(agg.averagesByCategory)) assert.equal(v, 0);
}

// Averages round, and best/worst pick the extreme overall scores.
{
  const rows = [
    row({ id: "a", overall: 90, scores: { visualHierarchy: 80, ctaProminence: 70, copyClarity: 60, readability: 50, layoutBalance: 40, trustSignals: 30 } }),
    row({ id: "b", overall: 40, scores: { visualHierarchy: 20, ctaProminence: 30, copyClarity: 40, readability: 50, layoutBalance: 60, trustSignals: 70 } }),
    row({ id: "c", overall: 65, scores: { visualHierarchy: 50, ctaProminence: 50, copyClarity: 50, readability: 50, layoutBalance: 50, trustSignals: 50 } }),
  ];
  const agg = computeAggregates(rows);
  assert.equal(agg.count, 3);
  assert.equal(agg.averageOverall, Math.round((90 + 40 + 65) / 3)); // 65
  assert.equal(agg.best?.id, "a");
  assert.equal(agg.worst?.id, "b");
  assert.equal(agg.averagesByCategory.visualHierarchy, Math.round((80 + 20 + 50) / 3)); // 50
  assert.equal(agg.averagesByCategory.trustSignals, Math.round((30 + 70 + 50) / 3)); // 50
}

console.log("Aggregate reducer basics passed.");

// ---------------------------------------------------------------------------
// Non-finite resilience.
//
// Rows come back from storage typed as `number`, but a partial write or schema
// drift can hand computeAggregates a null/NaN overall or category score. Before
// the finite() guard, a single such value turned averageOverall into NaN, which
// the history dashboard renders verbatim as the string "NaN". One malformed row
// must not poison the aggregates for the healthy rows around it.
{
  const rows = [
    row({ id: "ok1", overall: 80, scores: { visualHierarchy: 80, ctaProminence: 80, copyClarity: 80, readability: 80, layoutBalance: 80, trustSignals: 80 } }),
    // A malformed row: NaN overall and a NaN/missing category score.
    row({ id: "bad", overall: Number.NaN, scores: { visualHierarchy: Number.NaN, ctaProminence: 80, copyClarity: 80, readability: 80, layoutBalance: 80, trustSignals: 80 } as AnalysisRow["scores"] }),
    row({ id: "ok2", overall: 40, scores: { visualHierarchy: 40, ctaProminence: 40, copyClarity: 40, readability: 40, layoutBalance: 40, trustSignals: 40 } }),
  ];
  const agg = computeAggregates(rows);
  // Every aggregate stays a finite number rather than leaking NaN into the UI.
  assert.ok(Number.isFinite(agg.averageOverall), "averageOverall must stay finite");
  for (const [k, v] of Object.entries(agg.averagesByCategory)) {
    assert.ok(Number.isFinite(v), `averagesByCategory.${k} must stay finite`);
  }
  // The malformed overall is treated as 0: (80 + 0 + 40) / 3 = 40.
  assert.equal(agg.averageOverall, 40);
  // visualHierarchy: (80 + 0 + 40) / 3 = 40; the NaN score counted as 0.
  assert.equal(agg.averagesByCategory.visualHierarchy, 40);
  // The healthy high row is still best; the malformed row (treated as 0) is worst.
  assert.equal(agg.best?.id, "ok1");
  assert.equal(agg.worst?.id, "bad");
}

// A missing scores object entirely (defensive against a truncated row) must not
// throw and must count as zeros.
{
  const bad = row({ id: "noscores", overall: 50 });
  // @ts-expect-error deliberately drop the scores object to model a bad row.
  bad.scores = undefined;
  const agg = computeAggregates([bad]);
  assert.equal(agg.averageOverall, 50);
  for (const v of Object.values(agg.averagesByCategory)) assert.equal(v, 0);
}

console.log("Aggregate reducer non-finite resilience passed.");
