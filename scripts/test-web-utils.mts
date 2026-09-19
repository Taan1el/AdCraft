import assert from "node:assert/strict";

import { cn, formatPct01 } from "../apps/web/lib/utils.ts";

// cn joins truthy class names with a single space and drops falsy entries, so
// callers can write cn("base", cond && "active") without leaking "false" or
// stray whitespace into the DOM className.
{
  assert.equal(cn("a", "b", "c"), "a b c");
  assert.equal(cn("base", false, undefined, null, "active"), "base active");
  assert.equal(cn(), "");
  // An all-falsy call collapses to the empty string, not " " or "false".
  assert.equal(cn(false, null, undefined), "");
}

// formatPct01 renders a 0..1 ratio as a rounded whole-percent string.
{
  assert.equal(formatPct01(0), "0%");
  assert.equal(formatPct01(1), "100%");
  assert.equal(formatPct01(0.5), "50%");
  // Rounds to the nearest whole percent (0.5 rounds up via Math.round).
  assert.equal(formatPct01(0.005), "1%");
  assert.equal(formatPct01(0.004), "0%");
}

// Out-of-range ratios clamp into [0, 1] rather than reporting >100% or negative.
{
  assert.equal(formatPct01(1.5), "100%");
  assert.equal(formatPct01(-0.25), "0%");
}

// A non-finite input (missing/malformed metric) must never surface as "NaN%" or
// "Infinity%": Math.min/Math.max pass NaN straight through, so the finite guard
// is what coerces it to a safe 0%.
{
  assert.equal(formatPct01(NaN), "0%");
  assert.equal(formatPct01(Infinity), "0%");
  assert.equal(formatPct01(-Infinity), "0%");
}

console.log("web utils: ok");
