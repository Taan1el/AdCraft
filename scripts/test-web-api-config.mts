import assert from "node:assert/strict";

import { normalizeApiBase } from "../apps/web/lib/api-config.ts";

assert.equal(normalizeApiBase(undefined), "http://127.0.0.1:8010");

for (const blank of ["", " ", "\t\r\n"]) {
  assert.equal(normalizeApiBase(blank), null, "blank configuration must disable the backend");
}

assert.equal(
  normalizeApiBase("  https://api.example.test///  "),
  "https://api.example.test",
  "outer whitespace and every trailing slash must be removed",
);

console.log("Web API configuration tests passed.");
