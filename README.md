# AdCraft AI

AdCraft AI is a focused AI web app for reviewing ad creatives, landing page heroes, email banners, and social ads from a conversion perspective.

Instead of generating ads from scratch, the product critiques what already exists:

- what feels weak
- why it is weak
- how to improve it

That product decision is the point of the project. It demonstrates design judgment, frontend craft, backend architecture, and grounded AI integration without turning into a generic generator.

## Core flow

1. Upload one creative image
2. Select the asset type
3. Optionally add campaign context
4. Run analysis
5. Review:
  - overall score
  - category scores
  - summary
  - issues
  - recommendations
  - annotated preview

## Stack

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS

### Backend

- FastAPI
- Pydantic
- Pillow

### AI layer

- Deterministic visual metrics for grounded scoring
- Optional OpenAI Responses API refinement when `OPENAI_API_KEY` is available and `MOCK_ANALYSIS=false`
- Automatic fallback to deterministic analysis if the model is disabled or fails

## Repo layout

```text
apps/
  web/   # Next.js product UI
  api/   # FastAPI analysis service
docs/
  architecture.md
  case-study.md
assets/
  demo-images/
  screenshots/
```

## Local setup

### Frontend

```bash
cd apps/web
npm install
copy .env.example .env.local
npm run dev
```

### Backend

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

Frontend expects the API at `http://localhost:8000` by default.

## Environment variables

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### `apps/api/.env`

```env
MOCK_ANALYSIS=true
OPENAI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=
ALLOWED_ORIGIN=http://localhost:3000
```

## API

### `GET /health`

Returns service health and whether the app is in mock or hybrid mode.

### `POST /analyze`

Accepts multipart form data:

- `file`
- `adType`
- `campaignGoal` optional
- `audience` optional
- `brandName` optional

Returns a typed analysis payload with metrics, score breakdowns, annotations, issues, and recommendations.

## Why this project is strong

AdCraft AI is intentionally narrow. It avoids auth, billing, multi-user state, and dashboard sprawl so the project quality stays high in the parts that matter:

- product framing
- typed contracts
- useful UX
- explainable analysis
- polished frontend execution

## Next steps

- improve metric calibration with real creative samples
- add report export
- compare two creatives side by side
- add stronger LLM grounding using OCR or region-level extraction

