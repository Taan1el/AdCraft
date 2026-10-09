import assert from "node:assert/strict";

import {
  RemoteAnalyzeError,
  shouldFallBackToLocal,
  isAnalysisResponseShape,
} from "../apps/web/lib/analyze-fallback.ts";

// Client errors (4xx) the user must see — an invalid, oversized, or unsupported
// upload — are re-thrown so they can't be masked by a "successful" local run.
{
  for (const status of [400, 401, 403, 404, 413, 415, 422, 499]) {
    assert.equal(
      shouldFallBackToLocal(new RemoteAnalyzeError(status, "client error")),
      false,
      `HTTP ${status} must surface to the user, not fall back`,
    );
  }
}

// 408 (request timeout) and 429 (rate limit) are transient client codes: fall
// back to local heuristics rather than blocking the analysis.
{
  for (const status of [408, 429]) {
    assert.equal(
      shouldFallBackToLocal(new RemoteAnalyzeError(status, "transient")),
      true,
      `HTTP ${status} must fall back to local heuristics`,
    );
  }
}

// Availability failures (5xx) — including a cold-starting backend — fall back.
{
  for (const status of [500, 502, 503, 504]) {
    assert.equal(
      shouldFallBackToLocal(new RemoteAnalyzeError(status, "server error")),
      true,
      `HTTP ${status} must fall back to local heuristics`,
    );
  }
}

// Non-HTTP failures — a network drop, an AbortController timeout (surfaced as an
// Error with name "AbortError"), or anything that isn't a RemoteAnalyzeError —
// always fall back rather than surfacing a raw error to the user.
{
  assert.equal(shouldFallBackToLocal(new Error("network down")), true);

  const abort = new Error("The operation was aborted");
  abort.name = "AbortError";
  assert.equal(shouldFallBackToLocal(abort), true);

  assert.equal(shouldFallBackToLocal("just a string"), true);
  assert.equal(shouldFallBackToLocal(undefined), true);
  assert.equal(shouldFallBackToLocal(null), true);
  assert.equal(shouldFallBackToLocal({ status: 404 }), true, "a plain lookalike object is not a RemoteAnalyzeError");
}

// isAnalysisResponseShape guards against a 200 whose body is not an
// AnalysisResponse. A well-formed response passes; non-response bodies (an
// error envelope, an empty/HTML body, an array, or one missing a required
// top-level field) are rejected so api.ts can fall back to local heuristics.
{
  const valid = {
    analysisId: "analysis_1",
    image: { width: 1200, height: 600 },
    overallScore: 72,
    summary: "ok",
    categoryScores: {
      visualHierarchy: 70,
      ctaProminence: 68,
      copyClarity: 72,
      readability: 78,
      layoutBalance: 74,
      trustSignals: 66,
    },
    issues: [],
    recommendations: [{ id: "rec_1", category: "ctaProminence", priority: "medium", title: "t", action: "a" }],
    annotations: [],
    metrics: { whitespaceRatio: 0.2, visualDensity: 0.5, contrastScore: 0.6, ctaSaliencyScore: 0.5 },
  };
  assert.equal(isAnalysisResponseShape(valid), true, "a well-formed response must pass");

  // A valid body stays valid even if issues is non-empty (shallow check only).
  assert.equal(
    isAnalysisResponseShape({ ...valid, issues: [{ id: "i", category: "readability", severity: "high", title: "t", description: "d" }] }),
    true,
  );

  for (const bad of [
    null,
    undefined,
    "a string",
    42,
    [],
    {},
    { error: "Unsupported image type" },
    { ...valid, overallScore: "72" },
    { ...valid, overallScore: Number.NaN },
    { ...valid, categoryScores: null },
    { ...valid, metrics: [] },
    { ...valid, issues: "nope" },
    { ...valid, recommendations: undefined },
    (() => { const { annotations: _omit, ...rest } = valid; return rest; })(),
  ]) {
    assert.equal(isAnalysisResponseShape(bad), false, `malformed body must be rejected: ${JSON.stringify(bad)}`);
  }
}

console.log("web api fallback policy: ok");
