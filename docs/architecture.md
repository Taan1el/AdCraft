# AdCraft AI Architecture

## System shape

AdCraft AI is split into:

- a statically exported Next.js frontend for the product experience
- a configurable remote `POST /analyze` endpoint: either the lightweight Cloudflare Worker or the Python Starlette API
- browser-local pixel analysis used when no remote is configured, or when the configured endpoint has an availability failure

The product is designed around one narrow flow:

1. upload
2. analyze
3. explain
4. improve

## Frontend responsibilities

- image upload and preview
- ad type selection
- optional campaign context
- API request handling
- loading and error states
- structured result rendering
- annotation overlay rendering

## Backend responsibilities

- file validation
- image normalization
- deterministic metric computation
- optional LLM refinement
- schema validation for model-produced JSON
- explicit error and fallback handling

## Analysis pipeline

### 1. Intake

The backend accepts a single image plus optional context fields:

- ad type
- campaign goal
- audience
- brand name

### 2. Preprocess

The uploaded file is validated and normalized with Pillow:

- orientation fixed
- converted to RGB
- dimensions captured
- file type verified

### 3. Deterministic metrics

The backend computes grounded visual heuristics:

- whitespace ratio
- visual density
- contrast score
- CTA saliency score
- internal layout balance signal

These metrics provide a stable base layer and reduce generic AI output.

### 4. Rule-based analysis

A deterministic scorer converts visual metrics into:

- category scores
- issues
- recommendations
- annotation boxes
- summary

The browser-local analyzer and Worker always use deterministic analysis. The
Starlette API also builds this deterministic base, but when
`MOCK_ANALYSIS=false` it requires at least one model key; otherwise the request
returns 503 rather than silently treating mock output as AI output.

### 5. Optional Gemini or OpenAI refinement

When `MOCK_ANALYSIS=false`, the Starlette API prefers Gemini when
`GEMINI_API_KEY` is configured and otherwise uses OpenAI when
`OPENAI_API_KEY` is configured. It sends:

- the uploaded image
- structured metrics
- the current deterministic result
- user context

to the selected provider and requests JSON matching the current analysis
schema. The response is parsed and validated, then deterministic measurements
and annotations are pinned back onto the refined payload.

### 6. Fallback

Invalid model JSON gets one repair attempt; provider or validation failure then
keeps the deterministic Starlette result. Separately, the browser falls back to
its local analyzer for remote availability failures, timeouts, and rate limits.
Other remote 4xx responses remain visible because local analysis must not hide
invalid uploads or request errors.

## Why this shape works

Pure LLM critique would be flexible but often vague.

Pure rules would be stable but too rigid.

The hybrid design gives the app:

- explainability
- stability
- better product trust
- a clean seam for deeper AI later
