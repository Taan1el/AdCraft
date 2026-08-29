from __future__ import annotations

import json

from app.services.prompt_builder import build_prompt


def _split_input_json(prompt: str) -> dict:
    """Extract and parse the trailing INPUT JSON object embedded in the prompt."""
    marker = "INPUT (JSON):\n"
    assert marker in prompt
    return json.loads(prompt.split(marker, 1)[1])


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
    schema_start = prompt.index("OUTPUT JSON SHAPE EXAMPLE")
    input_start = prompt.index("INPUT (JSON):")
    schema_blob = prompt[schema_start:input_start]
    example = json.loads(schema_blob[schema_blob.index("{"):].strip())
    assert set(example["categoryScores"].keys()) == set(payload["rubric"].keys())
