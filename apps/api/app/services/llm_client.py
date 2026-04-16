from __future__ import annotations

import base64
import json
from typing import Any

import httpx
from PIL import Image


class LLMError(Exception):
    pass


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

    data = res.json()
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

    raise LLMError("Could not extract output text from OpenAI response")


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

    data = res.json()
    try:
        candidates = data.get("candidates", [])
        if not candidates:
            raise KeyError("candidates missing")
        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        texts = []
        for p in parts:
            t = p.get("text") if isinstance(p, dict) else None
            if isinstance(t, str):
                texts.append(t)
        if texts:
            return "\n".join(texts)
    except Exception as e:  # noqa: BLE001
        raise LLMError(f"Could not extract text from Gemini response: {e}") from e

    raise LLMError("Could not extract text from Gemini response")

