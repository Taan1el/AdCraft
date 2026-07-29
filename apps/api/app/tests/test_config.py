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


def test_create_app_uses_configured_debug_mode(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(main.settings, "debug", True)

    assert main.create_app().debug is True
