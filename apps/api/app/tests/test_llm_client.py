from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest
from PIL import Image
from pytest import MonkeyPatch

from app.services import llm_client
from app.services.llm_client import LLMError


class _FakeClient:
    def __init__(self, response: httpx.Response) -> None:
        self.response = response

    def __enter__(self) -> "_FakeClient":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def post(self, *_args: object, **_kwargs: object) -> httpx.Response:
        return self.response


def _invalid_json_response() -> httpx.Response:
    request = httpx.Request("POST", "https://provider.example/v1/analyze")
    return httpx.Response(200, text="<html>upstream error</html>", request=request)


@pytest.mark.parametrize(
    ("provider", "call"),
    [
        ("OpenAI", llm_client.call_openai_responses_api),
        ("Gemini", llm_client.call_gemini_generate_content),
    ],
)
def test_provider_invalid_json_is_wrapped_as_llm_error(
    monkeypatch: MonkeyPatch,
    provider: str,
    call: Callable[..., str],
) -> None:
    response = _invalid_json_response()
    monkeypatch.setattr(
        llm_client.httpx,
        "Client",
        lambda **_kwargs: _FakeClient(response),
    )

    with pytest.raises(LLMError, match=rf"^{provider} returned invalid JSON$"):
        call(
            api_key="test-key",
            model="test-model",
            prompt_text="Analyze this image.",
            image=Image.new("RGB", (2, 2), "white"),
        )


@pytest.mark.parametrize(
    ("provider", "call"),
    [
        ("OpenAI", llm_client.call_openai_responses_api),
        ("Gemini", llm_client.call_gemini_generate_content),
    ],
)
def test_provider_non_object_json_is_wrapped_as_llm_error(
    monkeypatch: MonkeyPatch,
    provider: str,
    call: Callable[..., str],
) -> None:
    # A valid-JSON but non-object body (e.g. a top-level array from an error
    # proxy) must surface as a clean LLMError, not an opaque AttributeError.
    request = httpx.Request("POST", "https://provider.example/v1/analyze")
    response = httpx.Response(200, content=json.dumps([{"unexpected": True}]), request=request)
    monkeypatch.setattr(
        llm_client.httpx,
        "Client",
        lambda **_kwargs: _FakeClient(response),
    )

    with pytest.raises(LLMError) as exc_info:
        call(
            api_key="test-key",
            model="test-model",
            prompt_text="Analyze this image.",
            image=Image.new("RGB", (2, 2), "white"),
        )
    # The message must not leak the internal AttributeError from calling
    # `.get` on a non-dict (e.g. "'list' object has no attribute 'get'").
    assert "has no attribute" not in str(exc_info.value)


def test_openai_nested_output_text_is_joined(monkeypatch: MonkeyPatch) -> None:
    body: dict[str, Any] = {
        "output": [
            {"content": [{"type": "output_text", "text": "first"}]},
            {"content": [{"type": "text", "text": "second"}]},
        ]
    }
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(200, content=json.dumps(body), request=request)
    monkeypatch.setattr(
        llm_client.httpx,
        "Client",
        lambda **_kwargs: _FakeClient(response),
    )

    result = llm_client.call_openai_responses_api(
        api_key="test-key",
        model="test-model",
        prompt_text="Analyze this image.",
        image=Image.new("RGB", (2, 2), "white"),
    )

    assert result == "first\nsecond"


class _RaisingClient:
    """Fake httpx.Client whose post() raises, exercising the request-failure path."""

    def __init__(self, exc: Exception) -> None:
        self.exc = exc

    def __enter__(self) -> "_RaisingClient":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def post(self, *_args: object, **_kwargs: object) -> httpx.Response:
        raise self.exc


def _patch_client(monkeypatch: MonkeyPatch, client: object) -> None:
    monkeypatch.setattr(llm_client.httpx, "Client", lambda **_kwargs: client)


def _tiny_image() -> Image.Image:
    return Image.new("RGB", (2, 2), "white")


def test_openai_returns_top_level_output_text(monkeypatch: MonkeyPatch) -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(
        200, content=json.dumps({"output_text": "direct answer"}), request=request
    )
    _patch_client(monkeypatch, _FakeClient(response))

    result = llm_client.call_openai_responses_api(
        api_key="k", model="m", prompt_text="p", image=_tiny_image()
    )
    assert result == "direct answer"


def test_openai_unextractable_output_raises(monkeypatch: MonkeyPatch) -> None:
    # output items whose "content" is not a list are skipped, leaving no text.
    body = {"output": [{"content": "not-a-list"}]}
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(200, content=json.dumps(body), request=request)
    _patch_client(monkeypatch, _FakeClient(response))

    with pytest.raises(LLMError, match="Could not extract output text"):
        llm_client.call_openai_responses_api(
            api_key="k", model="m", prompt_text="p", image=_tiny_image()
        )


def test_openai_http_error_status_is_wrapped(monkeypatch: MonkeyPatch) -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(500, text="upstream boom", request=request)
    _patch_client(monkeypatch, _FakeClient(response))

    with pytest.raises(LLMError, match=r"OpenAI error 500"):
        llm_client.call_openai_responses_api(
            api_key="k", model="m", prompt_text="p", image=_tiny_image()
        )


def test_openai_request_exception_is_wrapped(monkeypatch: MonkeyPatch) -> None:
    _patch_client(monkeypatch, _RaisingClient(httpx.ConnectError("no route")))

    with pytest.raises(LLMError, match="OpenAI request failed"):
        llm_client.call_openai_responses_api(
            api_key="k", model="m", prompt_text="p", image=_tiny_image()
        )


def test_gemini_extracts_candidate_text(monkeypatch: MonkeyPatch) -> None:
    body = {
        "candidates": [
            {"content": {"parts": [{"text": "line one"}, {"text": "line two"}]}}
        ]
    }
    request = httpx.Request("POST", "https://generativelanguage.googleapis.com")
    response = httpx.Response(200, content=json.dumps(body), request=request)
    _patch_client(monkeypatch, _FakeClient(response))

    result = llm_client.call_gemini_generate_content(
        api_key="k", model="m", prompt_text="p", image=_tiny_image()
    )
    assert result == "line one\nline two"


def test_gemini_missing_candidates_is_wrapped(monkeypatch: MonkeyPatch) -> None:
    request = httpx.Request("POST", "https://generativelanguage.googleapis.com")
    response = httpx.Response(200, content=json.dumps({"candidates": []}), request=request)
    _patch_client(monkeypatch, _FakeClient(response))

    with pytest.raises(LLMError, match="Could not extract text from Gemini"):
        llm_client.call_gemini_generate_content(
            api_key="k", model="m", prompt_text="p", image=_tiny_image()
        )


def test_gemini_http_error_status_is_wrapped(monkeypatch: MonkeyPatch) -> None:
    request = httpx.Request("POST", "https://generativelanguage.googleapis.com")
    response = httpx.Response(429, text="rate limited", request=request)
    _patch_client(monkeypatch, _FakeClient(response))

    with pytest.raises(LLMError, match=r"Gemini error 429"):
        llm_client.call_gemini_generate_content(
            api_key="k", model="m", prompt_text="p", image=_tiny_image()
        )


def test_gemini_request_exception_is_wrapped(monkeypatch: MonkeyPatch) -> None:
    _patch_client(monkeypatch, _RaisingClient(httpx.ReadTimeout("slow")))

    with pytest.raises(LLMError, match="Gemini request failed"):
        llm_client.call_gemini_generate_content(
            api_key="k", model="m", prompt_text="p", image=_tiny_image()
        )
