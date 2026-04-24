"""Keep API tests deterministic and offline by default."""

from __future__ import annotations

import os


def pytest_configure(config):  # noqa: ARG001
    # Runs before test collection imports `app`.
    os.environ["MOCK_ANALYSIS"] = "true"
    os.environ.pop("OPENAI_API_KEY", None)
    os.environ.pop("GEMINI_API_KEY", None)
