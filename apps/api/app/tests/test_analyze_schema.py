from __future__ import annotations

# `apps/api/conftest.py` sets MOCK_ANALYSIS=true before collection so /analyze stays offline.

from io import BytesIO

from PIL import Image
from jsonschema import validate
from starlette.testclient import TestClient

from app.main import app
from app.services.analysis_schema import ANALYSIS_RESPONSE_SCHEMA


def test_analyze_schema() -> None:
    client = TestClient(app)
    img = Image.new("RGB", (600, 315), "white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    files = {"file": ("test.png", buf.getvalue(), "image/png")}
    data = {"adType": "display_ad"}
    res = client.post("/analyze", files=files, data=data)
    assert res.status_code == 200
    validate(instance=res.json(), schema=ANALYSIS_RESPONSE_SCHEMA)

