from __future__ import annotations

import json

from PIL import Image
from pytest import MonkeyPatch

from app.services import analysis_pipeline
from app.services.analysis_schema import ANALYSIS_RESPONSE_SCHEMA
from app.services.visual_metrics import compute_deterministic_metrics


def _model_response_with_bogus_ground_truth() -> str:
    """A schema-valid response that lies about the server-owned fields."""
    return json.dumps(
        {
            "analysisId": "model-made-up-id",
            "image": {"width": 1, "height": 1},
            "overallScore": 50,
            "summary": "MODEL SUMMARY should survive",
            "categoryScores": {
                "visualHierarchy": 50,
                "ctaProminence": 50,
                "copyClarity": 50,
                "readability": 50,
                "layoutBalance": 50,
                "trustSignals": 50,
            },
            "issues": [
                {
                    "id": "issue_model",
                    "category": "readability",
                    "severity": "low",
                    "title": "Model issue",
                    "description": "From the model, should survive.",
                }
            ],
            "recommendations": [],
            "annotations": [
                {
                    "id": "ann_model_moved",
                    "type": "box",
                    "label": "Model relocated this overlay",
                    "x": 0.0,
                    "y": 0.0,
                    "w": 1.0,
                    "h": 1.0,
                }
            ],
            "metrics": {
                "whitespaceRatio": 0.99,
                "visualDensity": 0.99,
                "contrastScore": 0.99,
                "ctaSaliencyScore": 0.99,
            },
        }
    )


def test_pipeline_pins_server_owned_fields_over_model_output(monkeypatch: MonkeyPatch) -> None:
    image = Image.new("RGB", (600, 315), "white")

    monkeypatch.setattr(analysis_pipeline.settings, "mock_analysis", False)
    monkeypatch.setattr(analysis_pipeline.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(analysis_pipeline.settings, "openai_api_key", None)
    monkeypatch.setattr(
        analysis_pipeline,
        "call_gemini_generate_content",
        lambda **_kwargs: _model_response_with_bogus_ground_truth(),
    )

    result = analysis_pipeline.run_analysis(
        image=image,
        ad_type="display_ad",
        campaign_goal=None,
        audience=None,
        brand_name=None,
    )

    # Image dimensions come from the real upload, not the model's 1x1 lie.
    assert result["image"] == {"width": 600, "height": 315}

    # Metrics are the server's deterministic computation, not the 0.99 sentinels.
    metrics, _ = compute_deterministic_metrics(image)
    assert result["metrics"] == {
        "whitespaceRatio": metrics.whitespace_ratio,
        "visualDensity": metrics.visual_density,
        "contrastScore": metrics.contrast_score,
        "ctaSaliencyScore": metrics.cta_saliency_score,
    }

    # Scores are derived from those same measurements. The model can narrate
    # them, but it cannot substitute its schema-valid all-50 response.
    assert result["overallScore"] == int(
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
    assert result["categoryScores"] == {
        "visualHierarchy": int(round(55 + 45 * (1.0 - metrics.visual_density))),
        "ctaProminence": int(round(40 + 60 * metrics.cta_saliency_score)),
        "copyClarity": 72,
        "readability": int(round(45 + 55 * metrics.contrast_score)),
        "layoutBalance": 70,
        "trustSignals": 65,
    }
    assert result["categoryScores"] != {
        key: 50 for key in result["categoryScores"]
    }

    # analysisId is a fresh server-side uuid, not the model's made-up id.
    assert result["analysisId"] != "model-made-up-id"

    # Model-authored content fields are preserved untouched.
    assert result["summary"] == "MODEL SUMMARY should survive"
    assert result["issues"][0]["id"] == "issue_model"

    # Annotations are pixel-anchored overlays computed server-side, not the
    # full-frame box the model tried to substitute.
    _, server_annotations = compute_deterministic_metrics(image)
    assert result["annotations"] == server_annotations
    assert all(a["id"] != "ann_model_moved" for a in result["annotations"])


def test_pipeline_falls_back_to_base_response_on_invalid_model_output(monkeypatch: MonkeyPatch) -> None:
    from jsonschema import validate

    image = Image.new("RGB", (600, 315), "white")
    calls = 0

    def invalid_response(**_kwargs: object) -> str:
        nonlocal calls
        calls += 1
        return "not json at all"

    monkeypatch.setattr(analysis_pipeline.settings, "mock_analysis", False)
    monkeypatch.setattr(analysis_pipeline.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(analysis_pipeline.settings, "openai_api_key", None)
    monkeypatch.setattr(
        analysis_pipeline,
        "call_gemini_generate_content",
        invalid_response,
    )

    result = analysis_pipeline.run_analysis(
        image=image,
        ad_type="display_ad",
        campaign_goal=None,
        audience=None,
        brand_name=None,
    )

    # Both attempts fail to parse, so the deterministic base response is served.
    assert calls == 2
    validate(instance=result, schema=ANALYSIS_RESPONSE_SCHEMA)
    assert result["image"] == {"width": 600, "height": 315}


def test_pipeline_retries_then_falls_back_on_blank_model_copy(monkeypatch: MonkeyPatch) -> None:
    image = Image.new("RGB", (600, 315), "white")
    calls = 0

    def blank_response(**_kwargs: object) -> str:
        nonlocal calls
        calls += 1
        response = json.loads(_model_response_with_bogus_ground_truth())
        response["summary"] = "   "
        return json.dumps(response)

    monkeypatch.setattr(analysis_pipeline.settings, "mock_analysis", False)
    monkeypatch.setattr(analysis_pipeline.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(analysis_pipeline.settings, "openai_api_key", None)
    monkeypatch.setattr(
        analysis_pipeline,
        "call_gemini_generate_content",
        blank_response,
    )

    result = analysis_pipeline.run_analysis(
        image=image,
        ad_type="display_ad",
        campaign_goal=None,
        audience=None,
        brand_name=None,
    )

    assert calls == 2
    assert result["summary"].strip()


def test_pipeline_does_not_retry_provider_failures(monkeypatch: MonkeyPatch) -> None:
    from jsonschema import validate

    image = Image.new("RGB", (600, 315), "white")
    calls = 0

    def provider_failure(**_kwargs: object) -> str:
        nonlocal calls
        calls += 1
        raise analysis_pipeline.LLMError("provider unavailable")

    monkeypatch.setattr(analysis_pipeline.settings, "mock_analysis", False)
    monkeypatch.setattr(analysis_pipeline.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(analysis_pipeline.settings, "openai_api_key", None)
    monkeypatch.setattr(
        analysis_pipeline,
        "call_gemini_generate_content",
        provider_failure,
    )

    result = analysis_pipeline.run_analysis(
        image=image,
        ad_type="display_ad",
        campaign_goal=None,
        audience=None,
        brand_name=None,
    )

    assert calls == 1
    validate(instance=result, schema=ANALYSIS_RESPONSE_SCHEMA)
    assert result["image"] == {"width": 600, "height": 315}
