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
    deterministic base response — silently dropping the LLM critique.

    Handles the common ways a model dresses up the payload:
      * a bare ```…``` fence or a language-tagged ```json fence;
      * explanatory prose *before* the fence ("Here is the analysis:\\n```…");
      * a trailing sign-off *after* the closing fence ("```\\nHope this helps!");
      * a truncated response whose closing fence never arrived.
    Only fenced content is unwrapped — text with no fence at all is returned
    unchanged so genuine garbage still fails loudly downstream.
    """
    t = text.strip()
    open_idx = 0 if t.startswith("```") else t.find("```")
    if open_idx == -1:
        return t
    t = t[open_idx:]
    newline = t.find("\n")
    if newline == -1:
        # A single-line "```…" is malformed; let json.loads report it cleanly.
        return t
    inner = t[newline + 1 :]
    close_idx = inner.find("```")
    if close_idx != -1:
        inner = inner[:close_idx]
    return inner.strip()


def parse_json_object(text: str) -> dict[str, Any]:
    """Parse the model's response into a top-level JSON object.

    Tries the raw text first and only unwraps a Markdown code fence if that
    fails. The ordering matters: a model can return unfenced JSON whose string
    values legitimately contain a ``` sequence (e.g. an ad critique that quotes
    ```css```). ``_strip_code_fence`` would latch onto those in-string backticks
    and slice mid-object, corrupting otherwise-valid JSON — so it is used only as
    a fallback when the raw payload is not already parseable.
    """
    try:
        data = json.loads(text)
    except Exception:  # noqa: BLE001 -- retry via the fence stripper below
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

