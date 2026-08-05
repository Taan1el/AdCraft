from __future__ import annotations

import io

from PIL import Image, UnidentifiedImageError
from starlette.datastructures import FormData, UploadFile
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings
from app.services.analysis_pipeline import run_analysis


ALLOWED_AD_TYPES = {"display_ad", "landing_hero", "email_hero", "social_ad"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
MAX_CONTEXT_CHARS = 2_000


def _read_optional_context(form: FormData, name: str) -> str | None:
    value = form.get(name)
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise ValueError(f"Invalid {name}")
    value = value.strip()
    if len(value) > MAX_CONTEXT_CHARS:
        raise ValueError(f"{name} is too long")
    return value or None


async def analyze(request: Request) -> JSONResponse:
    try:
        form = await request.form()
    except ValueError:
        # python-multipart raises MultipartParseError (a ValueError subclass)
        # for malformed bodies. Treat bad client input as a 400 instead of
        # letting it escape through Starlette as an internal server error.
        return JSONResponse({"error": "Malformed multipart form data"}, status_code=400)
    upload = form.get("file")
    if not isinstance(upload, UploadFile):
        return JSONResponse({"error": "Missing file"}, status_code=400)

    ad_type = str(form.get("adType") or "")
    if ad_type not in ALLOWED_AD_TYPES:
        return JSONResponse(
            {"error": "Invalid adType", "allowed": sorted(ALLOWED_AD_TYPES)},
            status_code=400,
        )

    try:
        campaign_goal = _read_optional_context(form, "campaignGoal")
        audience = _read_optional_context(form, "audience")
        brand_name = _read_optional_context(form, "brandName")
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)

    contents = await upload.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        return JSONResponse({"error": "Uploaded file is too large"}, status_code=413)

    try:
        with Image.open(io.BytesIO(contents)) as source:
            width, height = source.size
            if width * height > MAX_IMAGE_PIXELS:
                return JSONResponse(
                    {"error": "Uploaded image has too many pixels"},
                    status_code=413,
                )
            image = source.convert("RGB")
    except Image.DecompressionBombError:
        return JSONResponse(
            {"error": "Uploaded image has too many pixels"},
            status_code=413,
        )
    except (UnidentifiedImageError, OSError):
        return JSONResponse({"error": "Uploaded file is not a readable image"}, status_code=400)

    if not settings.mock_analysis and not settings.has_llm_credentials:
        return JSONResponse(
            {
                "error": "Missing LLM credentials. Set GEMINI_API_KEY/OPENAI_API_KEY or set MOCK_ANALYSIS=true."
            },
            status_code=503,
        )

    result = run_analysis(
        image=image,
        ad_type=ad_type,
        campaign_goal=campaign_goal,
        audience=audience,
        brand_name=brand_name,
    )
    return JSONResponse(result)

