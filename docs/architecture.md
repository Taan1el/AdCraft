# AdCraft AI Architecture

## System shape

AdCraft AI is split into:

- a Next.js frontend for the product experience
- a FastAPI backend for analysis orchestration

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
- response validation through Pydantic
- fallback handling

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

This guarantees the product works even with no model key.

### 5. Optional OpenAI refinement

If `OPENAI_API_KEY` is present and `MOCK_ANALYSIS=false`, the backend sends:

- the uploaded image
- structured metrics
- the current deterministic result
- user context

to the OpenAI Responses API and requests a typed refinement. The backend merges that result into the deterministic payload.

### 6. Fallback

If the model call fails or returns unusable output, the backend keeps the deterministic result.

## Why this shape works

Pure LLM critique would be flexible but often vague.

Pure rules would be stable but too rigid.

The hybrid design gives the app:

- explainability
- stability
- better product trust
- a clean seam for deeper AI later
