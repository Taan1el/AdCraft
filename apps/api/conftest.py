"""Pytest hooks: ensure tests run with deterministic mock analysis before app modules import."""

from __future__ import annotations

import os


def pytest_configure(config):  # noqa: ARG001
    # Runs before test collection imports `app`; keeps /analyze fast and offline by default.
    os.environ["MOCK_ANALYSIS"] = "true"
    os.environ.pop("OPENAI_API_KEY", None)
    os.environ.pop("GEMINI_API_KEY", None)
