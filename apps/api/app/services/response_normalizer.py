from __future__ import annotations

import json
from typing import Any

from jsonschema import ValidationError, validate

from app.services.analysis_schema import ANALYSIS_RESPONSE_SCHEMA


class InvalidModelOutput(Exception):
    pass


def parse_json_object(text: str) -> dict[str, Any]:
    try:
        data = json.loads(text)
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

