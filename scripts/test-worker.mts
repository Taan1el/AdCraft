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

const corsResponse = await worker.fetch(
  new Request("https://worker.test/health", {
    headers: { origin: "https://client.test" },
  }),
  { ALLOWED_ORIGINS: " https://client.test/, https://client.test " },
);
assert.equal(corsResponse.status, 200);
assert.equal(corsResponse.headers.get("access-control-allow-origin"), "https://client.test");
assert.equal(corsResponse.headers.get("vary"), "origin");

console.log("Worker request and CORS tests passed.");
