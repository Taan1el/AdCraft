from __future__ import annotations

import json

from app.services.analysis_schema import ANALYSIS_RESPONSE_SCHEMA
from app.services.prompt_builder import build_prompt


def _split_input_json(prompt: str) -> dict:
    """Extract and parse the trailing INPUT JSON object embedded in the prompt."""
    marker = "INPUT (JSON):\n"
    assert marker in prompt
    return json.loads(prompt.split(marker, 1)[1])


def _split_schema_example(prompt: str) -> dict:
    """Extract and parse the type-only schema example block from the prompt."""
    schema_start = prompt.index("OUTPUT JSON SHAPE EXAMPLE")
    input_start = prompt.index("INPUT (JSON):")
    schema_blob = prompt[schema_start:input_start]
    return json.loads(schema_blob[schema_blob.index("{"):].strip())


def test_returns_non_empty_string() -> None:
    prompt = build_prompt(ad_type="social", context={}, base_response={})
    assert isinstance(prompt, str)
    assert prompt.strip()


def test_enforces_json_only_output() -> None:
    prompt = build_prompt(ad_type="social", context={}, base_response={})
    assert "Return ONLY a single JSON object (no markdown)" in prompt
    assert "Do not add extra keys." in prompt


def test_embeds_ad_type_and_context() -> None:
    prompt = build_prompt(
        ad_type="landing_hero",
        context={"brand": "Acme", "goal": "signups"},
        base_response={},
    )
    payload = _split_input_json(prompt)
    assert payload["adType"] == "landing_hero"
    assert payload["context"] == {"brand": "Acme", "goal": "signups"}


def test_embeds_base_response_verbatim() -> None:
    base = {"analysisId": "abc-123", "image": {"width": 800, "height": 600}}
    prompt = build_prompt(ad_type="social", context={}, base_response=base)
    payload = _split_input_json(prompt)
    assert payload["baseResponse"] == base


def test_includes_full_rubric() -> None:
    prompt = build_prompt(ad_type="social", context={}, base_response={})
    payload = _split_input_json(prompt)
    assert set(payload["rubric"].keys()) == {
        "visualHierarchy",
        "ctaProminence",
        "copyClarity",
        "readability",
        "layoutBalance",
        "trustSignals",
    }


def test_output_rules_present() -> None:
    prompt = build_prompt(ad_type="social", context={}, base_response={})
    payload = _split_input_json(prompt)
    rules = payload["outputRules"]
    assert "JSON only" in rules["format"]
    assert "generic advice" in rules["specificity"].lower()
    for field in ("overallScore", "categoryScores", "annotations", "metrics"):
        assert field in rules["groundTruth"]


def test_schema_example_categories_match_rubric() -> None:
    prompt = build_prompt(ad_type="social", context={}, base_response={})
    payload = _split_input_json(prompt)
    # The type-only schema example is emitted before the INPUT block; its
    # category keys must line up with the scoring rubric the model is given.
    example = _split_schema_example(prompt)
    assert set(example["categoryScores"].keys()) == set(payload["rubric"].keys())


def test_prompt_contract_matches_response_schema() -> None:
    # The prompt is what the model sees; ANALYSIS_RESPONSE_SCHEMA is what
    # response_normalizer judges its output against. Nothing tied the two
    # together: renaming a category (or metric) in the schema would leave the
    # prompt advertising stale names, so every LLM response would then fail
    # validation and silently fall back to the deterministic base. Pin the
    # object-shaped contract across that boundary.
    prompt = build_prompt(ad_type="social", context={}, base_response={})
    rubric = _split_input_json(prompt)["rubric"]
    example = _split_schema_example(prompt)
    props = ANALYSIS_RESPONSE_SCHEMA["properties"]

    def required(section: str) -> set[str]:
        return set(props[section]["required"])

    # Scored categories: the rubric, the example shape, and the schema's
    # required categoryScores keys must all describe the same six categories.
    schema_categories = required("categoryScores")
    assert set(rubric.keys()) == schema_categories
    assert set(example["categoryScores"].keys()) == schema_categories

    # Measured metrics and image dimensions the example advertises must match
    # the schema's required keys exactly.
    assert set(example["metrics"].keys()) == required("metrics")
    assert set(example["image"].keys()) == required("image")

    # Severity/priority vocab the example teaches ("low|medium|high") must be
    # exactly the schema's enum, or the model learns a value the validator
    # rejects (or omits one it would accept).
    severity_enum = props["issues"]["items"]["properties"]["severity"]["enum"]
    priority_enum = props["recommendations"]["items"]["properties"]["priority"]["enum"]
    assert example["issues"][0]["severity"].split("|") == severity_enum
    assert example["recommendations"][0]["priority"].split("|") == priority_enum
