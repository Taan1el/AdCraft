import assert from "node:assert/strict";

import {
  buildIssues,
  buildRecommendations,
  buildSummary,
  EXPOSURE_ADVICE_BAND,
  EXPOSURE_ISSUE_BAND,
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

const oddHeightData = new Uint8ClampedArray(3 * 5 * 4);
for (let y = 0; y < 5; y++) {
  const value = [0, 0, 255, 255, 0][y];
  for (let x = 0; x < 3; x++) {
    const offset = (y * 3 + x) * 4;
    oddHeightData.set([value, value, value, 255], offset);
  }
}
const oddHeight = sobelEdgeRatio({ width: 3, height: 5, data: oddHeightData });
assert.deepEqual(
  oddHeight,
  { ratio: 1, topRatio: 1, bottomRatio: 1 },
  "odd-height region ratios must use their actual pixel counts",
);

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

// ---------------------------------------------------------------------------
// Exposure-band invariant.
//
// The brightness thresholds used to live as bare literals in both builders and
// had drifted to 0.12/0.9 (issue) vs 0.15/0.88 (advice). They are now shared
// constants, and the contract is that the advice band fully contains the issue
// band on both ends: any frame flagged as an exposure *problem* must also get a
// fix *recommendation* — never a red issue with no advice on how to fix it.
assert.ok(
  EXPOSURE_ADVICE_BAND.dark >= EXPOSURE_ISSUE_BAND.dark,
  "advice dark cutoff must be at least the issue dark cutoff",
);
assert.ok(
  EXPOSURE_ADVICE_BAND.light <= EXPOSURE_ISSUE_BAND.light,
  "advice light cutoff must be at most the issue light cutoff",
);

// Drive it through the real builders across the full brightness range: wherever
// the brightness-extreme issue fires, the fix-exposure recommendation must fire
// too. This catches a future edit that widens the issue band past the advice
// band even if the constants above are edited in lockstep with it.
const exposureProbe = {
  ...baseMetrics,
  whitespaceRatio: 0.3,
  visualDensity: 0.12,
  contrastScore: 8,
  ctaSaliencyScore: 0.9,
  topRegionDensity: 0.3,
  bottomRegionDensity: 0.1,
};
const exposureScores = {
  visualHierarchy: 85,
  ctaProminence: 80,
  copyClarity: 82,
  readability: 95,
  layoutBalance: 80,
  trustSignals: 78,
};
for (let step = 0; step <= 100; step++) {
  const brightnessMean = step / 100;
  const metrics = { ...exposureProbe, brightnessMean };
  const hasIssue = buildIssues(metrics as never, exposureScores as never)
    .some((issue) => issue.id === "brightness-extreme");
  const hasRec = buildRecommendations(metrics as never, exposureScores as never)
    .some((rec) => rec.id === "fix-exposure");
  if (hasIssue) {
    assert.ok(
      hasRec,
      `brightnessMean ${brightnessMean.toFixed(2)} flags an exposure issue but offers no fix recommendation`,
    );
  }
}

console.log("Heuristic exposure-band invariant tests passed.");

// ---------------------------------------------------------------------------
// Summary-sentence invariants.
//
// buildSummary writes the one-line verdict the results screen leads with. It
// names the weakest category and picks a tier word from the overall score.
// Two ways it can quietly go wrong, neither caught before now: it could name a
// category that is not actually the lowest, or — because it maps the raw
// CategoryScores key to a human label — a missing/renamed key would leak a
// camelCase token like "trustSignals" straight into user-facing copy. Pin both,
// plus the tier thresholds at their boundaries so an off-by-one there can't
// silently reword every result.
const CATEGORY_KEYS = [
  "visualHierarchy",
  "ctaProminence",
  "copyClarity",
  "readability",
  "layoutBalance",
  "trustSignals",
] as const;

// Human labels buildSummary is expected to use — the moment a key leaks
// unmapped, its camelCase form would appear verbatim instead of one of these.
const CATEGORY_LABELS: Record<(typeof CATEGORY_KEYS)[number], string> = {
  visualHierarchy: "visual hierarchy",
  ctaProminence: "CTA prominence",
  copyClarity: "copy clarity",
  readability: "readability",
  layoutBalance: "layout balance",
  trustSignals: "trust signals",
};

// The summary must name whichever category actually holds the minimum score.
// Drive one distinct low per category so a hard-coded or mis-sorted pick fails.
for (const weakKey of CATEGORY_KEYS) {
  const scores = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [key, key === weakKey ? 20 : 80]),
  ) as Record<(typeof CATEGORY_KEYS)[number], number>;
  const summary = buildSummary(scores as never, 70);
  assert.ok(
    summary.includes(CATEGORY_LABELS[weakKey]),
    `summary should name the weakest category "${weakKey}" (${CATEGORY_LABELS[weakKey]})`,
  );
  // No raw camelCase key may reach the copy — only its mapped label. Skip
  // "readability", whose label is legitimately identical to its key; the guard
  // still catches every compound key (trustSignals, visualHierarchy, …) leaking.
  for (const key of CATEGORY_KEYS) {
    if (CATEGORY_LABELS[key] === key) continue;
    assert.ok(
      !summary.includes(key),
      `summary leaked the raw key "${key}" instead of a human label`,
    );
  }
}

// Tier word is chosen by overall: >=80 strong, >=65 decent, >=50 mixed, else
// weak. Check each boundary and the value just below it.
const flatScores = Object.fromEntries(
  CATEGORY_KEYS.map((key) => [key, 50]),
) as Record<(typeof CATEGORY_KEYS)[number], number>;
for (const [overall, tier] of [
  [80, "strong"],
  [79, "decent"],
  [65, "decent"],
  [64, "mixed"],
  [50, "mixed"],
  [49, "weak"],
] as const) {
  const summary = buildSummary(flatScores as never, overall);
  assert.ok(
    summary.includes(`${tier} overall (${overall}/100)`),
    `overall ${overall} should read as "${tier}" but got: ${summary}`,
  );
}

console.log("Heuristic summary-sentence invariant tests passed.");
