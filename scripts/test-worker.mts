import assert from "node:assert/strict";

import worker from "../apps/worker/src/index.ts";

function uploadForm(adType?: FormDataEntryValue): FormData {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([0])], "creative.png", { type: "image/png" }));
  if (adType !== undefined) form.set("adType", adType);
  return form;
}

async function analyze(form: FormData): Promise<Response> {
  return worker.fetch(
    new Request("https://worker.test/analyze", { method: "POST", body: form }),
    {},
  );
}

const validSignatures = [
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50] },
];

for (const { type, bytes } of validSignatures) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], "creative", { type }));
  form.set("adType", "display_ad");
  assert.equal((await analyze(form)).status, 200, `${type} signature should be accepted`);
}

const missing = await analyze(uploadForm());
assert.equal(missing.status, 400);
assert.equal((await missing.json() as { error?: string }).error, "Invalid adType");

const fileField = new File(["display_ad"], "ad-type.txt", { type: "text/plain" });
const nonText = await analyze(uploadForm(fileField));
assert.equal(nonText.status, 400);
assert.equal((await nonText.json() as { error?: string }).error, "Invalid adType");

const emptyForm = new FormData();
emptyForm.set("file", new File([], "empty.png", { type: "image/png" }));
emptyForm.set("adType", "display_ad");
const empty = await analyze(emptyForm);
assert.equal(empty.status, 400);
assert.equal((await empty.json() as { error?: string }).error, "Uploaded file is empty");

const unsupportedForm = new FormData();
unsupportedForm.set("file", new File(["not an image"], "creative.txt", { type: "text/plain" }));
unsupportedForm.set("adType", "display_ad");
const unsupported = await analyze(unsupportedForm);
assert.equal(unsupported.status, 400);
assert.deepEqual(await unsupported.json(), {
  error: "Unsupported image type",
  allowed: ["image/png", "image/jpeg", "image/webp"],
});

const spoofedForm = new FormData();
spoofedForm.set(
  "file",
  new File([new Uint8Array([0xff, 0xd8, 0xff])], "creative.png", { type: "image/png" }),
);
spoofedForm.set("adType", "display_ad");
const spoofed = await analyze(spoofedForm);
assert.equal(spoofed.status, 400);
assert.equal(
  (await spoofed.json() as { error?: string }).error,
  "Uploaded file signature does not match its image type",
);

const corsResponse = await worker.fetch(
  new Request("https://worker.test/health", {
    headers: { origin: "https://client.test" },
  }),
  { ALLOWED_ORIGINS: " https://client.test/, https://client.test " },
);
assert.equal(corsResponse.status, 200);
assert.equal(corsResponse.headers.get("access-control-allow-origin"), "https://client.test");
assert.equal(corsResponse.headers.get("vary"), "origin");

// An OPTIONS preflight short-circuits to 204 (no body) but must still carry the
// full CORS handshake: the echoed allow-origin for an allowed caller plus the
// method/header allowances a browser checks before sending the real POST.
const preflight = await worker.fetch(
  new Request("https://worker.test/analyze", {
    method: "OPTIONS",
    headers: { origin: "https://client.test" },
  }),
  { ALLOWED_ORIGINS: "https://client.test" },
);
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get("access-control-allow-origin"), "https://client.test");
assert.equal(preflight.headers.get("access-control-allow-methods"), "GET,POST,OPTIONS");
assert.equal(preflight.headers.get("access-control-allow-headers"), "content-type");

// An origin that is NOT in ALLOWED_ORIGINS must never receive an
// access-control-allow-origin header (the browser then blocks the read), but
// the request itself still succeeds and the static method allowance is present.
const foreignOrigin = await worker.fetch(
  new Request("https://worker.test/health", {
    headers: { origin: "https://evil.test" },
  }),
  { ALLOWED_ORIGINS: "https://client.test" },
);
assert.equal(foreignOrigin.status, 200);
assert.equal(foreignOrigin.headers.get("access-control-allow-origin"), null);
assert.equal(foreignOrigin.headers.get("access-control-allow-methods"), "GET,POST,OPTIONS");
// The ACAO decision keys off the request Origin, so even a denied response must
// carry Vary: origin — otherwise a URL-keyed shared cache could hand this
// no-ACAO body to an allowed caller (or the reverse).
assert.equal(foreignOrigin.headers.get("vary"), "origin");

// A request with no Origin header still varies by origin (the header's absence
// is what selects the no-ACAO branch), so Vary: origin is emitted there too.
const noOrigin = await worker.fetch(
  new Request("https://worker.test/health"),
  { ALLOWED_ORIGINS: "https://client.test" },
);
assert.equal(noOrigin.status, 200);
assert.equal(noOrigin.headers.get("access-control-allow-origin"), null);
assert.equal(noOrigin.headers.get("vary"), "origin");

// A "*" entry allows any caller: the worker echoes the request's own origin
// (not a literal "*") so the response stays compatible with credentialed reads.
const wildcard = await worker.fetch(
  new Request("https://worker.test/health", {
    headers: { origin: "https://anywhere.test" },
  }),
  { ALLOWED_ORIGINS: "*" },
);
assert.equal(wildcard.status, 200);
assert.equal(wildcard.headers.get("access-control-allow-origin"), "https://anywhere.test");
assert.equal(wildcard.headers.get("vary"), "origin");

// An unknown route falls through to a JSON 404 (still wrapped in CORS), not an
// unhandled exception or an empty body.
const notFound = await worker.fetch(new Request("https://worker.test/nope"), {});
assert.equal(notFound.status, 404);
assert.equal((await notFound.json() as { error?: string }).error, "Not found");

// /analyze rejects a non-multipart body up front, before touching formData(),
// so a mislabeled JSON post gets a clear 400 rather than a parse failure.
const nonMultipart = await worker.fetch(
  new Request("https://worker.test/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }),
  {},
);
assert.equal(nonMultipart.status, 400);
assert.equal(
  (await nonMultipart.json() as { error?: string }).error,
  "Expected multipart/form-data",
);

// The success path returns a rich critique object, but the checks above only
// assert its status. Pin the response invariants so a drift in the scoring or
// issue/recommendation builders (an out-of-range score, a NaN metric, a dropped
// default recommendation) can't ship a 200 with a malformed body.
const okForm = new FormData();
okForm.set(
  "file",
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "creative.png", {
    type: "image/png",
  }),
);
okForm.set("adType", "display_ad");
const okRes = await analyze(okForm);
assert.equal(okRes.status, 200);

type AnalyzeBody = {
  analysisId: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  metrics: Record<string, number>;
  issues: unknown[];
  recommendations: unknown[];
  annotations: unknown[];
};
const body = (await okRes.json()) as AnalyzeBody;

// analysisId carries its "analysis_" prefix so clients can tell it apart from
// issue/rec/annotation ids, which share the same uuid tail.
assert.ok(body.analysisId.startsWith("analysis_"), "analysisId should be prefixed");

const isPercent = (n: unknown): boolean =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 100;
assert.ok(isPercent(body.overallScore), "overallScore must be an integer 0..100");
for (const [key, value] of Object.entries(body.categoryScores)) {
  assert.ok(isPercent(value), `categoryScore ${key}=${value} must be an integer 0..100`);
}

// Metrics are clamped ratios: finite and within [0, 1], never NaN.
for (const [key, value] of Object.entries(body.metrics)) {
  assert.ok(
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1,
    `metric ${key}=${value} must be a finite ratio in [0, 1]`,
  );
}

assert.ok(Array.isArray(body.issues), "issues must be an array");
assert.ok(Array.isArray(body.annotations), "annotations must be an array");
// The builder guarantees at least one recommendation even when no issue fires.
assert.ok(
  Array.isArray(body.recommendations) && body.recommendations.length >= 1,
  "recommendations must always include at least one entry",
);

console.log("Worker request and CORS tests passed.");
