import assert from "node:assert/strict";

import { CATEGORY_LABELS, categoryLabel } from "../apps/web/lib/categories.ts";

// CATEGORY_LABELS is the single source of human-readable names for the six
// scored categories. The keys must stay in lockstep with the camelCase
// identifiers the API, schema, and heuristics emit — a drift here renders a
// raw "ctaProminence" to users instead of a label.
{
  assert.deepEqual(Object.keys(CATEGORY_LABELS).sort(), [
    "copyClarity",
    "ctaProminence",
    "layoutBalance",
    "readability",
    "trustSignals",
    "visualHierarchy",
  ]);
  // Exactly six categories are scored; a seventh key would mean the map and the
  // CategoryScores type have diverged.
  assert.equal(Object.keys(CATEGORY_LABELS).length, 6);
  // Every label is a non-empty, human-facing string (not the camelCase id).
  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0, `${key} label is empty`);
    assert.notEqual(label, key, `${key} label is still the raw identifier`);
  }
}

// categoryLabel resolves a known camelCase id to its label.
{
  assert.equal(categoryLabel("visualHierarchy"), "Visual hierarchy");
  assert.equal(categoryLabel("ctaProminence"), "CTA prominence");
  assert.equal(categoryLabel("trustSignals"), "Trust signals");
}

// Issue/recommendation `category` values are free strings an LLM can emit, so an
// unknown category is returned verbatim rather than collapsing to undefined or
// an empty string — the caller always gets something printable.
{
  assert.equal(categoryLabel("somethingNew"), "somethingNew");
  assert.equal(categoryLabel(""), "");
  // A label that happens to look like prose passes straight through.
  assert.equal(categoryLabel("Overall impact"), "Overall impact");
}

console.log("web categories: ok");
