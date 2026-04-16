from __future__ import annotations

import uuid

from PIL import Image

from app.core.config import settings
from app.services.llm_client import (
    LLMError,
    call_gemini_generate_content,
    call_openai_responses_api,
)
from app.services.prompt_builder import build_prompt
from app.services.response_normalizer import (
    InvalidModelOutput,
    parse_json_object,
    validate_analysis_response,
)
from app.services.visual_metrics import compute_deterministic_metrics


def run_analysis(
    *,
    image: Image.Image,
    ad_type: str,
    campaign_goal: str | None,
    audience: str | None,
    brand_name: str | None,
    force_mock: bool,
) -> dict:
    metrics, annotations = compute_deterministic_metrics(image)

    overall = int(
        round(
            100
            * (
                0.25 * metrics.contrast_score
                + 0.25 * (1.0 - metrics.visual_density)
                + 0.25 * metrics.whitespace_ratio
                + 0.25 * metrics.cta_saliency_score
            )
        )
    )
    overall = max(0, min(100, overall))

    category = {
        "visualHierarchy": max(0, min(100, int(round(55 + 45 * (1.0 - metrics.visual_density))))),
        "ctaProminence": max(0, min(100, int(round(40 + 60 * metrics.cta_saliency_score)))),
        "copyClarity": 72,
        "readability": max(0, min(100, int(round(45 + 55 * metrics.contrast_score)))),
        "layoutBalance": 70,
        "trustSignals": 65,
    }

    issues: list[dict] = []
    recs: list[dict] = []

    if metrics.contrast_score < 0.45:
        issues.append(
            {
                "id": "issue_contrast_low",
                "category": "readability",
                "severity": "high",
                "title": "Low contrast reduces readability",
                "description": "Key text/button regions may blend into the background, especially on mobile.",
            }
        )
        recs.append(
            {
                "id": "rec_increase_contrast",
                "category": "readability",
                "priority": "high",
                "title": "Increase contrast for key text + CTA",
                "action": "Darken the background behind text or increase text/CTA luminance difference to meet WCAG contrast targets.",
            }
        )

    if metrics.cta_saliency_score < 0.5:
        issues.append(
            {
                "id": "issue_cta_weak",
                "category": "cta_prominence",
                "severity": "high",
                "title": "CTA is not visually dominant",
                "description": "The CTA likely competes with nearby elements, lowering click priority.",
            }
        )
        recs.append(
            {
                "id": "rec_cta_separation",
                "category": "cta_prominence",
                "priority": "high",
                "title": "Increase CTA separation",
                "action": "Add whitespace around the button, increase contrast, and reduce competing elements in the same region.",
            }
        )

    summary = (
        f"Mock analysis for {ad_type}. This score is grounded in basic visual metrics "
        f"(contrast, density, whitespace, CTA saliency). Enable real AI critique by adding an API key."
    )

    w, h = image.size
    base_response: dict = {
        "analysisId": str(uuid.uuid4()),
        "image": {"width": w, "height": h},
        "overallScore": overall,
        "summary": summary,
        "categoryScores": category,
        "issues": issues,
        "recommendations": recs,
        "annotations": annotations,
        "metrics": {
            "whitespaceRatio": metrics.whitespace_ratio,
            "visualDensity": metrics.visual_density,
            "contrastScore": metrics.contrast_score,
            "ctaSaliencyScore": metrics.cta_saliency_score,
        },
    }

    if force_mock or settings.mock_analysis:
        return base_response

    context = {"campaignGoal": campaign_goal, "audience": audience, "brandName": brand_name}
    prompt = build_prompt(ad_type=ad_type, context=context, base_response=base_response)

    def _attempt(extra_instruction: str | None = None) -> dict:
        prompt_text = prompt if not extra_instruction else (prompt + "\n\nIMPORTANT:\n" + extra_instruction)
        raw: str
        if settings.gemini_api_key:
            raw = call_gemini_generate_content(
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
                prompt_text=prompt_text,
                image=image,
            )
        elif settings.openai_api_key:
            raw = call_openai_responses_api(
                api_key=settings.openai_api_key,
                model=settings.openai_model,
                prompt_text=prompt_text,
                image=image,
            )
        else:
            raise LLMError("No LLM API key configured (set GEMINI_API_KEY or OPENAI_API_KEY).")
        data = parse_json_object(raw.strip())
        validate_analysis_response(data)
        return data

    try:
        return _attempt()
    except (LLMError, InvalidModelOutput) as e:
        try:
            return _attempt(
                "Your previous output was invalid. Return ONLY one JSON object that matches the schema exactly. "
                f"Validation error: {str(e)[:300]}"
            )
        except (LLMError, InvalidModelOutput):
            return base_response

