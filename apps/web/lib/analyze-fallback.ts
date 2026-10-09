// The remote-analyze fallback policy, kept in its own module — free of the "@/"
// value imports that make api.ts unreachable from the Node test runner — so the
// nuanced re-throw/fall-back rule can be unit-tested directly. This mirrors how
// aggregate helpers live apart from the Supabase-bound history module.

import type { AnalysisResponse } from "@adcraft/shared-types";

export class RemoteAnalyzeError extends Error {
  readonly status: number;

  // Field is assigned in the body rather than via a TypeScript parameter
  // property so this module also runs under Node's strip-only TS loader (used by
  // the scripts/test-web-*.mts runner), which rejects parameter properties.
  constructor(status: number, message: string) {
    super(message);
    this.name = "RemoteAnalyzeError";
    this.status = status;
  }
}

export function remoteAnalyzeErrorMessage(status: number): string {
  return `Analyze request failed with HTTP ${status}`;
}

// Decide whether a failed remote analyze should quietly fall back to the local
// heuristic path (true) or surface to the user (false).
//
// A remote failure reaches the user only when it is a *client* error the local
// heuristics can't legitimately stand in for: a 4xx other than 408 (request
// timeout) and 429 (rate limit). Running an invalid or oversized upload through
// local heuristics would otherwise hide a real client-side rejection behind a
// misleading "successful" analysis.
//
// Availability failures (5xx), those two timeout/throttle codes, and non-HTTP
// errors (a network drop or an AbortController timeout, which arrive as a plain
// Error rather than a RemoteAnalyzeError) all fall back to local heuristics, so
// a flaky or cold-starting backend never blocks an analysis.
export function shouldFallBackToLocal(err: unknown): boolean {
  if (
    err instanceof RemoteAnalyzeError &&
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 408 &&
    err.status !== 429
  ) {
    return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Shallow shape check for a remote /analyze body. A backend can answer 200 with
// a body that is not an AnalysisResponse at all — an HTML error page from a
// proxy, an empty body, or a `{ "error": ... }` envelope — and `res.ok` alone
// would hand that straight to the UI as a "successful" analysis, rendering
// garbage or crashing a component that reads `categoryScores`/`metrics`.
//
// The check is deliberately shallow: it asserts the top-level fields the UI
// unconditionally reads (a numeric score, the score/metric objects, and the
// three list fields) exist with the right coarse type, without validating every
// nested value. That is enough to reject a non-response body while staying
// lenient toward valid responses whose optional nested fields vary — a strict
// deep check could reject a legitimate backend variant and wrongly suppress a
// real result. A false result routes the caller to the same local-heuristic
// fallback a network error already takes.
export function isAnalysisResponseShape(value: unknown): value is AnalysisResponse {
  if (!isRecord(value)) return false;
  if (typeof value.overallScore !== "number" || !Number.isFinite(value.overallScore)) {
    return false;
  }
  if (!isRecord(value.categoryScores) || !isRecord(value.metrics)) return false;
  return (
    Array.isArray(value.issues) &&
    Array.isArray(value.recommendations) &&
    Array.isArray(value.annotations)
  );
}
