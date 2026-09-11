import assert from "node:assert/strict";

import {
  buildIssues,
  buildRecommendations,
  sobelEdgeRatio,
} from "../apps/web/lib/heuristics.ts";

for (const [width, height] of [[1, 1], [1, 8], [8, 1], [2, 2], [2, 8], [8, 2]]) {
  const result = sobelEdgeRatio({
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  });

  assert.deepEqual(
    result,
    { ratio: 0, topRatio: 0, bottomRatio: 0 },
    `${width}x${height} image must produce finite zero edge ratios`,
  );
}

const regular = sobelEdgeRatio({
  width: 3,
  height: 3,
  data: new Uint8ClampedArray(3 * 3 * 4),
});
assert.ok(Object.values(regular).every(Number.isFinite), "regular edge ratios must stay finite");

console.log("Heuristic edge-ratio tests passed.");

// ---------------------------------------------------------------------------
// Issue/recommendation taxonomy coverage.
//
// Every issue/recommendation the client emits carries a `category` that the UI
// looks up in CATEGORY_LABELS (lib/categories.ts) and a level field the badge
// styling switches on. A drifted value — a snake_case category, a "warning"
// severity — renders raw or unstyled, the exact bug the API guards against in
// test_deterministic_issue_categories_match_category_taxonomy. The web side had
// no equivalent guard, so pin the taxonomy here and drive every branch through
// it. These six keys mirror `ScoreCategory` / CategoryScores in
// @adcraft/shared-types and the API schema; keep them in lockstep.
const VALID_CATEGORIES = new Set([
  "visualHierarchy",
  "ctaProminence",
  "copyClarity",
  "readability",
  "layoutBalance",
  "trustSignals",
]);
const VALID_LEVELS = new Set(["low", "medium", "high"]);

const baseMetrics = {
  width: 1200,
  height: 628,
  aspectRatio: 1200 / 628,
  // brightnessMean/Std are normalized 0-1 (measureBrightness); 0.5 sits in the
  // healthy exposure band so it triggers neither the dark nor washed-out branch.
  brightnessMean: 0.5,
  brightnessStd: 0.16,
  paletteSize: 6,
};

// Fixtures chosen to collectively exercise every issue and recommendation
// branch: a crowded low-contrast frame with a flat hierarchy, an over-sparse
// high-contrast frame, and a healthy frame that should fall through to the
// A/B-test recommendation.
const fixtures = [
  {
    metrics: {
      ...baseMetrics,
      whitespaceRatio: 0.05,
      visualDensity: 0.5,
      contrastScore: 2,
      ctaSaliencyScore: 0,
      topRegionDensity: 0.5,
      bottomRegionDensity: 0.5,
    },
    scores: {
      visualHierarchy: 40,
      ctaProminence: 45,
      copyClarity: 40,
      readability: 30,
      layoutBalance: 35,
      trustSignals: 50,
    },
  },
  {
    metrics: {
      ...baseMetrics,
      whitespaceRatio: 0.8,
      visualDensity: 0.05,
      contrastScore: 8,
      ctaSaliencyScore: 1,
      topRegionDensity: 0.4,
      bottomRegionDensity: 0.05,
    },
    scores: {
      visualHierarchy: 80,
      ctaProminence: 70,
      copyClarity: 80,
      readability: 95,
      layoutBalance: 70,
      trustSignals: 75,
    },
  },
  {
    metrics: {
      ...baseMetrics,
      whitespaceRatio: 0.3,
      visualDensity: 0.12,
      contrastScore: 8,
      ctaSaliencyScore: 0.9,
      topRegionDensity: 0.3,
      bottomRegionDensity: 0.1,
    },
    scores: {
      visualHierarchy: 85,
      ctaProminence: 80,
      copyClarity: 82,
      readability: 95,
      layoutBalance: 80,
      trustSignals: 78,
    },
  },
  {
    // Under-exposed frame: exercises the brightness-extreme issue and the
    // fix-exposure recommendation while other metrics stay healthy.
    metrics: {
      ...baseMetrics,
      brightnessMean: 0.05,
      brightnessStd: 0.04,
      whitespaceRatio: 0.3,
      visualDensity: 0.12,
      contrastScore: 8,
      ctaSaliencyScore: 0.9,
      topRegionDensity: 0.3,
      bottomRegionDensity: 0.1,
    },
    scores: {
      visualHierarchy: 85,
      ctaProminence: 80,
      copyClarity: 82,
      readability: 95,
      layoutBalance: 80,
      trustSignals: 40,
    },
  },
];

const seenIssueIds = new Set<string>();
const seenRecIds = new Set<string>();

for (const { metrics, scores } of fixtures) {
  const issues = buildIssues(metrics as never, scores as never);
  const recs = buildRecommendations(metrics as never, scores as never);

  for (const issue of issues) {
    assert.ok(
      VALID_CATEGORIES.has(issue.category),
      `issue ${issue.id} has unknown category ${issue.category}`,
    );
    assert.ok(
      VALID_LEVELS.has(issue.severity),
      `issue ${issue.id} has unknown severity ${issue.severity}`,
    );
    seenIssueIds.add(issue.id);
  }

  for (const rec of recs) {
    assert.ok(
      VALID_CATEGORIES.has(rec.category),
      `rec ${rec.id} has unknown category ${rec.category}`,
    );
    assert.ok(
      VALID_LEVELS.has(rec.priority),
      `rec ${rec.id} has unknown priority ${rec.priority}`,
    );
    seenRecIds.add(rec.id);
  }
}

// The fixtures are meant to reach every branch; if a builder grows a new one it
// should come with a fixture that covers it (and proves its taxonomy is valid).
for (const id of ["contrast-low", "whitespace-low", "whitespace-high", "density-high", "cta-weak", "hierarchy-flat", "brightness-extreme"]) {
  assert.ok(seenIssueIds.has(id), `no fixture triggered issue "${id}"`);
}
for (const id of ["boost-contrast", "stronger-cta", "reduce-clutter", "add-padding", "ab-test", "fix-exposure"]) {
  assert.ok(seenRecIds.has(id), `no fixture triggered recommendation "${id}"`);
}

console.log("Heuristic issue/recommendation taxonomy tests passed.");
