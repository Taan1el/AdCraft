import assert from "node:assert/strict";

import {
  RemoteAnalyzeError,
  shouldFallBackToLocal,
} from "../apps/web/lib/analyze-fallback.ts";

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
