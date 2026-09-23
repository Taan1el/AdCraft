import assert from "node:assert/strict";

import {
  RemoteAnalyzeError,
  shouldFallBackToLocal,
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

console.log("web api fallback policy: ok");
