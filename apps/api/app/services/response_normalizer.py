from __future__ import annotations

import json
from typing import Any

from jsonschema import ValidationError, validate

from app.services.analysis_schema import ANALYSIS_RESPONSE_SCHEMA


class InvalidModelOutput(Exception):
    pass


def _strip_code_fence(text: str) -> str:
    """Unwrap a Markdown code fence around a JSON payload, if present.

    The prompt asks for raw JSON, but models routinely ignore that and wrap the
    object in a ```json … ``` block. Without this, a fenced-but-otherwise-valid
    response fails json.loads, burns a retry call, and often falls back to the
    deterministic base response — silently dropping the LLM critique. Only the
    wrapping fence is removed; non-fenced text is returned unchanged so genuine
    garbage still fails loudly downstream.
    """
    t = text.strip()
    if not t.startswith("```"):
        return t
    newline = t.find("\n")
    if newline == -1:
        # A single-line "```…" is malformed; let json.loads report it cleanly.
        return t
    inner = t[newline + 1 :].rstrip()
    if inner.endswith("```"):
        inner = inner[: inner.rfind("```")]
    return inner.strip()


def parse_json_object(text: str) -> dict[str, Any]:
    try:
        data = json.loads(_strip_code_fence(text))
    except Exception as e:  # noqa: BLE001
        raise InvalidModelOutput(f"Model did not return valid JSON: {e}") from e
    if not isinstance(data, dict):
        raise InvalidModelOutput("Model JSON must be an object at top-level")
    return data


def validate_analysis_response(data: dict[str, Any]) -> None:
    try:
        validate(instance=data, schema=ANALYSIS_RESPONSE_SCHEMA)
    except ValidationError as e:
        raise InvalidModelOutput(f"Model JSON failed schema validation: {e.message}") from e

