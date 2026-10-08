from __future__ import annotations

import pytest
from pytest import MonkeyPatch

from app import main
from app.core.config import Settings


def test_debug_defaults_to_disabled(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.delenv("DEBUG", raising=False)

    assert Settings().debug is False


def test_debug_can_be_enabled_explicitly(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("DEBUG", "true")

    assert Settings().debug is True


def test_whitespace_only_api_keys_do_not_enable_llm(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "   ")
    monkeypatch.setenv("GEMINI_API_KEY", "\t")

    settings = Settings()

    assert settings.openai_api_key is None
    assert settings.gemini_api_key is None
    assert settings.has_llm_credentials is False


def test_api_keys_trim_accidental_outer_whitespace(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "  test-key  ")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    settings = Settings()

    assert settings.openai_api_key == "test-key"
    assert settings.has_llm_credentials is True


def test_model_names_trim_outer_whitespace(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_MODEL", "  gpt-test  ")
    monkeypatch.setenv("GEMINI_MODEL", "  gemini-test\t")

    settings = Settings()

    assert settings.openai_model == "gpt-test"
    assert settings.gemini_model == "gemini-test"


def test_blank_model_names_use_defaults(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_MODEL", "   ")
    monkeypatch.setenv("GEMINI_MODEL", "\t")

    settings = Settings()

    assert settings.openai_model == "gpt-4.1-mini"
    assert settings.gemini_model == "gemini-flash-latest"


def test_llm_timeout_defaults_to_45(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.delenv("LLM_TIMEOUT_S", raising=False)

    assert Settings().llm_timeout_s == 45.0


def test_llm_timeout_reads_positive_override(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_TIMEOUT_S", "12.5")

    assert Settings().llm_timeout_s == 12.5


@pytest.mark.parametrize("value", ["0", "-1", "abc", "   ", ""])
def test_llm_timeout_falls_back_on_invalid_or_nonpositive(
    monkeypatch: MonkeyPatch, value: str
) -> None:
    # A stray 0/-1/typo must not disable the timeout and let a call hang forever.
    monkeypatch.setenv("LLM_TIMEOUT_S", value)

    assert Settings().llm_timeout_s == 45.0


def test_create_app_uses_configured_debug_mode(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(main.settings, "debug", True)

    assert main.create_app().debug is True


def test_allowed_origins_list_splits_and_trims(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv(
        "ALLOWED_ORIGINS", " https://a.example , http://b.example ,, "
    )

    assert Settings().allowed_origins_list == [
        "https://a.example",
        "http://b.example",
    ]


def test_allowed_origins_list_strips_trailing_slash(monkeypatch: MonkeyPatch) -> None:
    # A trailing slash makes CORSMiddleware's exact-match never fire against a
    # browser Origin header, silently blocking the deployed frontend.
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://taan1el.github.io/")

    assert Settings().allowed_origins_list == ["https://taan1el.github.io"]


def test_allowed_origins_list_dedupes_preserving_order(monkeypatch: MonkeyPatch) -> None:
    # Slash-normalized duplicates must collapse to a single entry, first wins.
    monkeypatch.setenv(
        "ALLOWED_ORIGINS",
        "https://a.example/,https://a.example,http://b.example,https://a.example",
    )

    assert Settings().allowed_origins_list == [
        "https://a.example",
        "http://b.example",
    ]


def test_allowed_origins_list_wildcard_survives(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setenv("ALLOWED_ORIGINS", "*")

    assert Settings().allowed_origins_list == ["*"]
