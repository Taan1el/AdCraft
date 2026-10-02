from __future__ import annotations

from copy import deepcopy
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


def test_parse_json_object_unwraps_json_code_fence() -> None:
    # Models often wrap the object in ```json … ``` despite the prompt.
    fenced = '```json\n{"a": 1, "b": [2, 3]}\n```'
    assert parse_json_object(fenced) == {"a": 1, "b": [2, 3]}


def test_parse_json_object_unwraps_bare_code_fence() -> None:
    fenced = '```\n{"a": 1}\n```'
    assert parse_json_object(fenced) == {"a": 1}


def test_parse_json_object_unwraps_fence_with_surrounding_whitespace() -> None:
    fenced = '\n\n  ```json\n{"ok": true}\n```   \n'
    assert parse_json_object(fenced) == {"ok": True}


def test_parse_json_object_unwraps_fence_after_prose() -> None:
    # Models often prepend a sentence before the fenced payload.
    fenced = 'Here is the analysis you asked for:\n```json\n{"a": 1}\n```'
    assert parse_json_object(fenced) == {"a": 1}


def test_parse_json_object_ignores_trailing_signoff() -> None:
    # ...and sometimes add a sign-off after the closing fence.
    fenced = '```json\n{"a": 1}\n```\nHope this helps! Let me know if you need more.'
    assert parse_json_object(fenced) == {"a": 1}


def test_parse_json_object_handles_truncated_fence() -> None:
    # A cut-off response may never emit the closing fence.
    fenced = '```json\n{"a": 1, "b": 2}'
    assert parse_json_object(fenced) == {"a": 1, "b": 2}


def test_parse_json_object_fenced_non_object_still_rejected() -> None:
    # Unwrapping must not smuggle a non-object past the top-level check.
    with pytest.raises(InvalidModelOutput, match="object at top-level"):
        parse_json_object("```json\n[1, 2, 3]\n```")


def test_parse_json_object_keeps_unfenced_json_with_inline_backticks() -> None:
    # Valid *unfenced* JSON whose string value contains a ``` sequence (e.g. an
    # ad critique that quotes a code snippet) must parse as-is. Feeding it to the
    # fence stripper would slice at the in-string backticks and corrupt it, so
    # the raw text has to be tried before any unwrapping.
    raw = '{"summary": "Use a code block like ```css for the CTA styling."}'
    assert parse_json_object(raw) == {
        "summary": "Use a code block like ```css for the CTA styling.",
    }


def test_parse_json_object_still_unwraps_fenced_json_with_inline_backticks() -> None:
    # The raw-first parse must not regress the fenced path: a genuinely fenced
    # payload is still unwrapped even when its content mentions backticks.
    fenced = '```json\n{"note": "avoid nested ` marks"}\n```'
    assert parse_json_object(fenced) == {"note": "avoid nested ` marks"}


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


def test_validate_rejects_off_contract_issue_severity() -> None:
    # The UI badge only styles low/medium/high; anything else silently renders
    # as "low", so a model that invents "critical" must fail validation (and be
    # re-prompted) rather than mislabel a severe issue as low.
    broken = _valid_response()
    broken["issues"][0]["severity"] = "critical"
    with pytest.raises(InvalidModelOutput, match="schema validation"):
        validate_analysis_response(broken)


def test_validate_rejects_off_contract_recommendation_priority() -> None:
    broken = _valid_response()
    broken["recommendations"][0]["priority"] = "urgent"
    with pytest.raises(InvalidModelOutput, match="schema validation"):
        validate_analysis_response(broken)


@pytest.mark.parametrize(
    ("section", "field"),
    [
        (None, "analysisId"),
        (None, "summary"),
        ("issues", "id"),
        ("issues", "category"),
        ("issues", "title"),
        ("issues", "description"),
        ("recommendations", "id"),
        ("recommendations", "category"),
        ("recommendations", "title"),
        ("recommendations", "action"),
        ("annotations", "id"),
        ("annotations", "label"),
    ],
)
@pytest.mark.parametrize("blank", ["", " \t\n"])
def test_validate_rejects_blank_model_owned_text(
    section: str | None,
    field: str,
    blank: str,
) -> None:
    broken = deepcopy(_valid_response())
    target = broken if section is None else broken[section][0]
    target[field] = blank

    with pytest.raises(InvalidModelOutput, match="schema validation"):
        validate_analysis_response(broken)


@pytest.mark.parametrize(("field", "value"), [("width", 0), ("height", -1)])
def test_validate_rejects_non_positive_image_dimensions(field: str, value: int) -> None:
    broken = deepcopy(_valid_response())
    broken["image"][field] = value

    with pytest.raises(InvalidModelOutput, match="schema validation"):
        validate_analysis_response(broken)


@pytest.mark.parametrize(("field", "value"), [("w", 0), ("h", 0)])
def test_validate_rejects_zero_area_annotations(field: str, value: int) -> None:
    broken = deepcopy(_valid_response())
    broken["annotations"][0][field] = value

    with pytest.raises(InvalidModelOutput, match="positive width and height"):
        validate_analysis_response(broken)


@pytest.mark.parametrize(("field", "value"), [("x", 0.8), ("y", 0.95)])
def test_validate_rejects_annotations_outside_image(field: str, value: float) -> None:
    broken = deepcopy(_valid_response())
    broken["annotations"][0][field] = value

    with pytest.raises(InvalidModelOutput, match="within the image bounds"):
        validate_analysis_response(broken)


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_validate_rejects_non_finite_numbers(value: float) -> None:
    broken = deepcopy(_valid_response())
    broken["metrics"]["contrastScore"] = value

    with pytest.raises(InvalidModelOutput, match="must be finite"):
        validate_analysis_response(broken)


@pytest.mark.parametrize("section", ["issues", "recommendations", "annotations"])
def test_validate_rejects_duplicate_collection_ids(section: str) -> None:
    broken = deepcopy(_valid_response())
    broken[section].append(deepcopy(broken[section][0]))

    with pytest.raises(InvalidModelOutput, match=f"{section} must use unique IDs"):
        validate_analysis_response(broken)


@pytest.mark.parametrize("section", ["issues", "recommendations", "annotations"])
def test_validate_caps_model_owned_collections(section: str) -> None:
    broken = deepcopy(_valid_response())
    template = broken[section][0]
    broken[section] = [dict(template, id=f"item_{index}") for index in range(21)]

    with pytest.raises(InvalidModelOutput, match="schema validation"):
        validate_analysis_response(broken)
