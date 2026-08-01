from __future__ import annotations

# `apps/api/conftest.py` sets MOCK_ANALYSIS=true before collection so /analyze stays offline.

from io import BytesIO

from PIL import Image
from jsonschema import validate
from pytest import MonkeyPatch
from starlette.testclient import TestClient

from app.api.routes import analyze as analyze_route
from app.main import app
from app.services.analysis_schema import ANALYSIS_RESPONSE_SCHEMA


def _png_bytes(size: tuple[int, int] = (600, 315)) -> bytes:
    img = Image.new("RGB", size, "white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_analyze_schema() -> None:
    client = TestClient(app)

    files = {"file": ("test.png", _png_bytes(), "image/png")}
    data = {"adType": "display_ad"}
    res = client.post("/analyze", files=files, data=data)
    assert res.status_code == 200
    validate(instance=res.json(), schema=ANALYSIS_RESPONSE_SCHEMA)


def test_analyze_rejects_upload_over_byte_limit(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(analyze_route, "MAX_UPLOAD_BYTES", 16)
    client = TestClient(app)

    res = client.post(
        "/analyze",
        files={"file": ("test.png", _png_bytes((2, 2)), "image/png")},
        data={"adType": "display_ad"},
    )

    assert res.status_code == 413
    assert res.json() == {"error": "Uploaded file is too large"}


def test_analyze_rejects_image_over_pixel_limit(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(analyze_route, "MAX_IMAGE_PIXELS", 3)
    client = TestClient(app)

    res = client.post(
        "/analyze",
        files={"file": ("test.png", _png_bytes((2, 2)), "image/png")},
        data={"adType": "display_ad"},
    )

    assert res.status_code == 413
    assert res.json() == {"error": "Uploaded image has too many pixels"}

