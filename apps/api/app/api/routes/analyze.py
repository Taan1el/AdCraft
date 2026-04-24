from __future__ import annotations

import io

from PIL import Image
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings
from app.services.analysis_pipeline import run_analysis


ALLOWED_AD_TYPES = {"display_ad", "landing_hero", "email_hero", "social_ad"}


async def analyze(request: Request) -> JSONResponse:
    form = await request.form()
    upload = form.get("file")
    if upload is None:
        return JSONResponse({"error": "Missing file"}, status_code=400)

    ad_type = str(form.get("adType") or "")
    if ad_type not in ALLOWED_AD_TYPES:
        return JSONResponse(
            {"error": "Invalid adType", "allowed": sorted(ALLOWED_AD_TYPES)},
            status_code=400,
        )

    contents = await upload.read()  # type: ignore[attr-defined]
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    if not settings.mock_analysis and not settings.has_llm_credentials:
        return JSONResponse(
            {
                "error": (
                    "AI analysis is enabled (MOCK_ANALYSIS=false) but no LLM credentials are set. "
                    "Set GEMINI_API_KEY or OPENAI_API_KEY, or set MOCK_ANALYSIS=true for "
                    "deterministic-only analysis without an API key."
                )
            },
            status_code=503,
        )

    result = run_analysis(
        image=image,
        ad_type=ad_type,
        campaign_goal=str(form.get("campaignGoal") or "") or None,
        audience=str(form.get("audience") or "") or None,
        brand_name=str(form.get("brandName") or "") or None,
    )
    return JSONResponse(result)

