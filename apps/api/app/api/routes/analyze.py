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

    result = run_analysis(
        image=image,
        ad_type=ad_type,
        campaign_goal=str(form.get("campaignGoal") or "") or None,
        audience=str(form.get("audience") or "") or None,
        brand_name=str(form.get("brandName") or "") or None,
        force_mock=settings.mock_analysis or not settings.openai_api_key,
    )
    return JSONResponse(result)

