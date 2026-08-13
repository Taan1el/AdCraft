from __future__ import annotations

# `apps/api/conftest.py` sets MOCK_ANALYSIS=true before collection so /analyze stays offline.

from io import BytesIO

from PIL import Image
from starlette.testclient import TestClient

from app.api.routes.analyze import ALLOWED_AD_TYPES
from app.main import app


def _png_bytes(size: tuple[int, int] = (4, 4)) -> bytes:
    img = Image.new("RGB", size, "white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_analyze_rejects_missing_file() -> None:
    client = TestClient(app)

    res = client.post("/analyze", data={"adType": "display_ad"})

    assert res.status_code == 400
    assert res.json() == {"error": "Missing file"}


def test_analyze_rejects_unknown_ad_type() -> None:
    client = TestClient(app)

    res = client.post(
        "/analyze",
        files={"file": ("test.png", _png_bytes(), "image/png")},
        data={"adType": "billboard"},
    )

    assert res.status_code == 400
    body = res.json()
    assert body["error"] == "Invalid adType"
    assert body["allowed"] == sorted(ALLOWED_AD_TYPES)


def test_analyze_rejects_missing_ad_type() -> None:
    client = TestClient(app)

    res = client.post(
        "/analyze",
        files={"file": ("test.png", _png_bytes(), "image/png")},
    )

    assert res.status_code == 400
    assert res.json()["error"] == "Invalid adType"


def test_analyze_rejects_unreadable_image() -> None:
    client = TestClient(app)

    res = client.post(
        "/analyze",
        files={"file": ("test.png", b"this is not a real image", "image/png")},
        data={"adType": "display_ad"},
    )

    assert res.status_code == 400
    assert res.json() == {"error": "Uploaded file is not a readable image"}


def test_analyze_rejects_non_text_optional_context() -> None:
    # A field sent as a file part arrives as an UploadFile, not a string; the
    # route must reject it rather than pass a file handle to the analysis.
    client = TestClient(app)

    res = client.post(
        "/analyze",
        files={
            "file": ("test.png", _png_bytes(), "image/png"),
            "campaignGoal": ("goal.txt", b"conversions", "text/plain"),
        },
        data={"adType": "display_ad"},
    )

    assert res.status_code == 400
    assert res.json() == {"error": "Invalid campaignGoal"}
