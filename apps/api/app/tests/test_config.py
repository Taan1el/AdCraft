from __future__ import annotations

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
