from __future__ import annotations

import base64
import json
from typing import Any

import httpx
from PIL import Image


class LLMError(Exception):
    pass


def _response_json(provider: str, response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError as e:
        raise LLMError(f"{provider} returned invalid JSON") from e


def _openai_no_text_reason(data: dict[str, Any]) -> str | None:
    """Explain why an OpenAI Responses body carried no usable text.

    An empty output is usually not a bug in our extraction but a signal from the
    API: a top-level error, a truncated ("incomplete") response, or a model
    refusal. Surfacing that reason turns a bare "could not extract" into
    something actionable in logs instead of silently falling back.
    """
    err = data.get("error")
    if isinstance(err, dict) and isinstance(err.get("message"), str) and err["message"]:
        return f"error: {err['message'][:200]}"
    if data.get("status") == "incomplete":
        details = data.get("incomplete_details")
        reason = details.get("reason") if isinstance(details, dict) else None
        return f"incomplete: {reason}" if isinstance(reason, str) and reason else "incomplete"
    output = data.get("output")
    if isinstance(output, list):
        for item in output:
            content = item.get("content") if isinstance(item, dict) else None
            if not isinstance(content, list):
                continue
            for c in content:
                if isinstance(c, dict) and c.get("type") == "refusal":
                    refusal = c.get("refusal")
                    if isinstance(refusal, str) and refusal:
                        return f"refusal: {refusal[:200]}"
    return None


def _gemini_no_text_reason(data: dict[str, Any]) -> str | None:
    """Explain why a Gemini generateContent body carried no usable text.

    A prompt-level block (``promptFeedback.blockReason``) or a candidate
    ``finishReason`` (SAFETY, MAX_TOKENS, RECITATION) is the real cause far more
    often than a malformed shape, and it is otherwise thrown away.
    """
    feedback = data.get("promptFeedback")
    if isinstance(feedback, dict):
        block = feedback.get("blockReason")
        if isinstance(block, str) and block:
            return f"blockReason={block}"
    candidates = data.get("candidates")
    if isinstance(candidates, list) and candidates and isinstance(candidates[0], dict):
        finish = candidates[0].get("finishReason")
        if isinstance(finish, str) and finish:
            return f"finishReason={finish}"
    return None


def _image_to_data_url(image: Image.Image) -> str:
    from io import BytesIO

    buf = BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def call_openai_responses_api(
    *,
    api_key: str,
    model: str,
    prompt_text: str,
    image: Image.Image,
    timeout_s: float = 45.0,
) -> str:
    url = "https://api.openai.com/v1/responses"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    body: dict[str, Any] = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt_text},
                    {"type": "input_image", "image_url": _image_to_data_url(image)},
                ],
            }
        ],
    }

    try:
        with httpx.Client(timeout=timeout_s) as client:
            res = client.post(url, headers=headers, content=json.dumps(body).encode("utf-8"))
    except Exception as e:  # noqa: BLE001
        raise LLMError(f"OpenAI request failed: {e}") from e

    if res.status_code >= 400:
        raise LLMError(f"OpenAI error {res.status_code}: {res.text[:4000]}")

    data = _response_json("OpenAI", res)
    if isinstance(data, dict):
        if isinstance(data.get("output_text"), str) and data["output_text"].strip():
            return data["output_text"]
        output = data.get("output")
        if isinstance(output, list):
            texts: list[str] = []
            for item in output:
                content = item.get("content") if isinstance(item, dict) else None
                if not isinstance(content, list):
                    continue
                for c in content:
                    if isinstance(c, dict) and c.get("type") in {"output_text", "text"}:
                        t = c.get("text")
                        if isinstance(t, str):
                            texts.append(t)
            if texts:
                return "\n".join(texts)

    reason = _openai_no_text_reason(data) if isinstance(data, dict) else None
    suffix = f" ({reason})" if reason else ""
    raise LLMError(f"Could not extract output text from OpenAI response{suffix}")


def _image_to_inline_data(image: Image.Image) -> dict[str, str]:
    from io import BytesIO

    buf = BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return {"mime_type": "image/png", "data": b64}


def call_gemini_generate_content(
    *,
    api_key: str,
    model: str,
    prompt_text: str,
    image: Image.Image,
    timeout_s: float = 45.0,
) -> str:
    """
    Calls Gemini `generateContent` and returns text (expected JSON).
    """

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    headers = {"Content-Type": "application/json", "X-goog-api-key": api_key}

    body: dict[str, Any] = {
        "contents": [
            {
                "parts": [
                    {"text": prompt_text},
                    {"inline_data": _image_to_inline_data(image)},
                ]
            }
        ]
    }

    try:
        with httpx.Client(timeout=timeout_s) as client:
            res = client.post(url, headers=headers, content=json.dumps(body).encode("utf-8"))
    except Exception as e:  # noqa: BLE001
        raise LLMError(f"Gemini request failed: {e}") from e

    if res.status_code >= 400:
        raise LLMError(f"Gemini error {res.status_code}: {res.text[:4000]}")

    data = _response_json("Gemini", res)
    # Mirror the OpenAI path: a valid-JSON but non-object body (e.g. a top-level
    # array from an error proxy) would otherwise reach `data.get` and surface as
    # an opaque AttributeError instead of a clean provider error.
    if not isinstance(data, dict):
        raise LLMError("Gemini returned unexpected JSON shape (expected an object)")

    candidates = data.get("candidates")
    if isinstance(candidates, list) and candidates and isinstance(candidates[0], dict):
        content = candidates[0].get("content")
        parts = content.get("parts") if isinstance(content, dict) else None
        if isinstance(parts, list):
            texts = [p["text"] for p in parts if isinstance(p, dict) and isinstance(p.get("text"), str)]
            if texts:
                return "\n".join(texts)

    # No usable text. Prefer the API's own reason (safety block, truncation)
    # over a bare message, and guard every access above with isinstance so a
    # non-dict candidate/content can never surface as an opaque AttributeError.
    reason = _gemini_no_text_reason(data)
    suffix = f" ({reason})" if reason else ""
    raise LLMError(f"Could not extract text from Gemini response{suffix}")

