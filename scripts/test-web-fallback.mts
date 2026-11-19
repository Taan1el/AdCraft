import assert from "node:assert/strict";

import {
  isAnalysisResponseShape,
  RemoteAnalyzeError,
  remoteAnalyzeErrorMessage,
  shouldFallBackToLocal,
} from "../apps/web/lib/analyze-fallback.ts";

const validAnalysis = {
  analysisId: "analysis_1",
  image: { width: 1200, height: 600 },
  overallScore: 75,
  summary: "Clear hierarchy",
  categoryScores: {
    visualHierarchy: 75,
    ctaProminence: 70,
    copyClarity: 72,
    readability: 78,
    layoutBalance: 74,
    trustSignals: 68,
  },
  issues: [],
  recommendations: [],
  annotations: [],
  metrics: {
    whitespaceRatio: 0.28,
    visualDensity: 0.45,
    contrastScore: 0.62,
    ctaSaliencyScore: 0.55,
  },
};

assert.equal(isAnalysisResponseShape(validAnalysis), true);

// The whole reason this guard exists: a backend can answer 200 with a body that
// is not an object at all — an empty body (null/undefined), a proxy's HTML error
// page (a string), or a bare JSON array. `res.ok` alone would hand any of these
// to the UI as a "successful" analysis; the top-level record guard must reject
// them so the caller falls back to local heuristics instead.
for (const nonRecord of [null, undefined, "<html>502 Bad Gateway</html>", 42, [], true]) {
  assert.equal(
    isAnalysisResponseShape(nonRecord),
    false,
    "a non-object remote body must never pass as an AnalysisResponse",
  );
}

// A well-formed annotation with positive extents that stay within the image must
// be accepted — the degenerate/out-of-bounds rejections below are the contrast.
assert.equal(
  isAnalysisResponseShape({
    ...validAnalysis,
    annotations: [{ id: "box_1", type: "box", label: "CTA", x: 0.6, y: 0.1, w: 0.3, h: 0.2 }],
  }),
  true,
);

// The in-bounds check is inclusive: a box whose far edge lands exactly on the
// image border (x + w === 1 and y + h === 1) still encloses a real region and
// must be accepted — only true overflow (> 1, asserted below) is rejected.
assert.equal(
  isAnalysisResponseShape({
    ...validAnalysis,
    annotations: [{ id: "box_1", type: "box", label: "CTA", x: 0.7, y: 0.6, w: 0.3, h: 0.4 }],
  }),
  true,
);

for (const malformed of [
  { ...validAnalysis, image: { width: "1200", height: 600 } },
  { ...validAnalysis, image: { width: 1200.5, height: 600 } },
  { ...validAnalysis, overallScore: 101 },
  { ...validAnalysis, categoryScores: { ...validAnalysis.categoryScores, readability: -1 } },
  { ...validAnalysis, categoryScores: { ...validAnalysis.categoryScores, readability: Number.NaN } },
  { ...validAnalysis, metrics: { ...validAnalysis.metrics, contrastScore: 1.1 } },
  { ...validAnalysis, metrics: { ...validAnalysis.metrics, contrastScore: undefined } },
  { ...validAnalysis, issues: [null] },
  { ...validAnalysis, recommendations: [{ id: "rec_1" }] },
  {
    ...validAnalysis,
    issues: [{ id: "issue_1", category: "layout", severity: "high", title: "   ", description: "Crowded" }],
  },
  {
    ...validAnalysis,
    recommendations: [{ id: "rec_1", category: "layout", priority: "high", title: "Simplify", action: "" }],
  },
  // A box that overflows the image on either axis (x + w > 1, or y + h > 1)
  // points outside the rendered creative; the API clamps model output to the
  // unit square, so the client validator rejects both overflow directions —
  // not just the x axis.
  {
    ...validAnalysis,
    annotations: [{ id: "box_1", type: "box", label: "CTA", x: 0.8, y: 0.1, w: 0.3, h: 0.2 }],
  },
  {
    ...validAnalysis,
    annotations: [{ id: "box_1", type: "box", label: "CTA", x: 0.1, y: 0.8, w: 0.2, h: 0.3 }],
  },
  // A negative origin anchors the box off the top/left edge; coordinates must be
  // in [0, 1], so a sub-zero x or y is rejected before it can offset the overlay.
  {
    ...validAnalysis,
    annotations: [{ id: "box_1", type: "box", label: "CTA", x: -0.1, y: 0.1, w: 0.2, h: 0.2 }],
  },
  {
    ...validAnalysis,
    annotations: [{ id: "box_1", type: "box", label: "CTA", x: 0.1, y: -0.1, w: 0.2, h: 0.2 }],
  },
  // A degenerate box with zero width or zero height encloses no region and would
  // render as an invisible overlay; the API rejects w/h <= 0, so the client
  // validator must too.
  {
    ...validAnalysis,
    annotations: [{ id: "box_1", type: "box", label: "CTA", x: 0.2, y: 0.1, w: 0, h: 0.2 }],
  },
  {
    ...validAnalysis,
    annotations: [{ id: "box_1", type: "box", label: "CTA", x: 0.2, y: 0.1, w: 0.3, h: 0 }],
  },
  { ...validAnalysis, analysisId: null },
  { ...validAnalysis, analysisId: "   " },
  { ...validAnalysis, summary: null },
  { ...validAnalysis, summary: "\t" },
]) {
  assert.equal(
    isAnalysisResponseShape(malformed),
    false,
    "malformed nested response fields must be rejected before reaching the UI",
  );
}

// A 4xx client error (other than 408/429) means the upload itself was rejected —
// invalid, oversized, unauthorized. Running it through local heuristics would
// hide a real rejection behind a misleading "successful" analysis, so it must
// surface to the user rather than fall back.
{
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(400, "bad request")), false);
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(401, "unauthorized")), false);
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(413, "payload too large")), false);
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(422, "unprocessable")), false);
  // The upper edge of the client-error range is still a surface-to-user case.
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(499, "client closed")), false);
}

// Response bodies can contain proxy HTML, stack traces, or provider details.
// User-visible failures expose only the status code.
{
  assert.equal(remoteAnalyzeErrorMessage(400), "Analyze request failed with HTTP 400");
  assert.equal(remoteAnalyzeErrorMessage(503), "Analyze request failed with HTTP 503");
}

// 408 (request timeout) and 429 (rate limit) are the two 4xx codes the local
// heuristics can legitimately stand in for: the request was well-formed, the
// backend just could not serve it in time, so fall back rather than block.
{
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(408, "timeout")), true);
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(429, "too many requests")), true);
}

// 5xx availability failures (cold start, crash, gateway) fall back so a flaky or
// still-waking backend never blocks an analysis.
{
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(500, "internal")), true);
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(502, "bad gateway")), true);
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(503, "unavailable")), true);
}

// Non-HTTP failures — a network drop or an AbortController timeout — arrive as a
// plain Error rather than a RemoteAnalyzeError, and must also fall back.
{
  assert.equal(shouldFallBackToLocal(new Error("network error")), true);
  assert.equal(shouldFallBackToLocal(new DOMException("aborted", "AbortError")), true);
}

// Defensive: a thrown non-error value (string, null, undefined, plain object)
// is not a client rejection we can identify, so it falls back rather than
// surfacing an opaque failure to the user.
{
  assert.equal(shouldFallBackToLocal("boom"), true);
  assert.equal(shouldFallBackToLocal(null), true);
  assert.equal(shouldFallBackToLocal(undefined), true);
  assert.equal(shouldFallBackToLocal({ status: 400 }), true);
}

// An out-of-band status below the 4xx range (defensive: a mis-constructed error)
// is not a client rejection either, so it falls back.
{
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(0, "no status")), true);
  assert.equal(shouldFallBackToLocal(new RemoteAnalyzeError(302, "redirect")), true);
}

// RemoteAnalyzeError carries the HTTP status and a stable name so callers can
// log and branch on it; it remains a real Error subclass.
{
  const err = new RemoteAnalyzeError(503, "unavailable");
  assert.ok(err instanceof Error);
  assert.ok(err instanceof RemoteAnalyzeError);
  assert.equal(err.status, 503);
  assert.equal(err.name, "RemoteAnalyzeError");
  assert.equal(err.message, "unavailable");
}

console.log("web fallback: ok");
