from __future__ import annotations

import json

import pytest

from app.services.response_normalizer import (
    InvalidModelOutput,
    parse_json_object,
    validate_analysis_response,
)


def test_parse_json_object_returns_dict() -> None:
    assert parse_json_object('{"a": 1, "b": [2, 3]}') == {"a": 1, "b": [2, 3]}


def test_parse_json_object_rejects_invalid_json() -> None:
    with pytest.raises(InvalidModelOutput, match="valid JSON"):
        parse_json_object("not json at all")


def test_parse_json_object_rejects_non_object_top_level() -> None:
    # A JSON array is valid JSON but not an object; the schema needs an object.
    with pytest.raises(InvalidModelOutput, match="object at top-level"):
        parse_json_object("[1, 2, 3]")


def _valid_response() -> dict:
    return {
        "analysisId": "an_123",
        "image": {"width": 600, "height": 315},
        "overallScore": 72,
        "summary": "Solid layout with a weak call to action.",
        "categoryScores": {
            "visualHierarchy": 70,
            "ctaProminence": 55,
            "copyClarity": 80,
            "readability": 75,
            "layoutBalance": 68,
            "trustSignals": 60,
        },
        "issues": [
            {
                "id": "iss_cta",
                "category": "cta",
                "severity": "medium",
                "title": "Weak CTA",
                "description": "Button blends into the background.",
            },
        ],
        "recommendations": [
            {
                "id": "rec_cta",
                "category": "cta",
                "priority": "high",
                "title": "Boost CTA contrast",
                "action": "Use a high-contrast button color.",
            },
        ],
        "annotations": [
            {"id": "ann_cta_candidate", "type": "box", "label": "CTA",
             "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1},
        ],
        "metrics": {
            "whitespaceRatio": 0.6,
            "visualDensity": 0.3,
            "contrastScore": 0.5,
            "ctaSaliencyScore": 0.4,
        },
    }


def test_validate_accepts_schema_conformant_object() -> None:
    # Round-trips through parse to mirror the real pipeline path.
    data = parse_json_object(json.dumps(_valid_response()))
    validate_analysis_response(data)  # should not raise


def test_validate_rejects_object_missing_required_fields() -> None:
    broken = _valid_response()
    del broken["overallScore"]
    with pytest.raises(InvalidModelOutput, match="schema validation"):
        validate_analysis_response(broken)
