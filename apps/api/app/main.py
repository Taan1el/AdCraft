from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import AdType, AnalysisResponse
from app.services import analyze_creative

load_dotenv()

app = FastAPI(title="AdCraft AI API", version="0.1.0")

allowed_origin = os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    mock_mode = os.getenv("MOCK_ANALYSIS", "true").lower() == "true"
    return {
        "status": "ok",
        "mode": "mock" if mock_mode or not os.getenv("OPENAI_API_KEY") else "hybrid",
    }


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    file: UploadFile = File(...),
    adType: AdType = Form(...),
    campaignGoal: str | None = Form(default=None),
    audience: str | None = Form(default=None),
    brandName: str | None = Form(default=None),
) -> AnalysisResponse:
    try:
        file_bytes = await file.read()
        return analyze_creative(
            file_bytes=file_bytes,
            content_type=file.content_type or "",
            ad_type=adType,
            campaign_goal=campaignGoal,
            audience=audience,
            brand_name=brandName,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=500,
            detail="Analysis failed unexpectedly. Please try again.",
        ) from exc
