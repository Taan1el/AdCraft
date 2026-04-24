from __future__ import annotations

import os
from io import BytesIO

from PIL import Image
from starlette.testclient import TestClient

from app.tests.reload_app import reload_analysis_stack


def test_analyze_returns_503_when_llm_mode_without_keys() -> None:
    saved = {k: os.environ.get(k) for k in ("MOCK_ANALYSIS", "OPENAI_API_KEY", "GEMINI_API_KEY")}
    try:
        os.environ["MOCK_ANALYSIS"] = "false"
        os.environ.pop("OPENAI_API_KEY", None)
        os.environ.pop("GEMINI_API_KEY", None)
        app = reload_analysis_stack()
        client = TestClient(app)
        img = Image.new("RGB", (600, 315), "white")
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        files = {"file": ("test.png", buf.getvalue(), "image/png")}
        data = {"adType": "display_ad"}
        res = client.post("/analyze", files=files, data=data)
        assert res.status_code == 503
        body = res.json()
        assert "error" in body
        assert "MOCK_ANALYSIS" in body["error"]
        assert "GEMINI_API_KEY" in body["error"] or "OPENAI_API_KEY" in body["error"]
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        reload_analysis_stack()
