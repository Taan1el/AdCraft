from __future__ import annotations

# `apps/api/conftest.py` sets MOCK_ANALYSIS=true before collection so /analyze stays offline.

import asyncio
from io import BytesIO

from PIL import Image
from pytest import MonkeyPatch
from starlette.datastructures import FormData, UploadFile
from starlette.testclient import TestClient

from app.api.routes import analyze as analyze_route
from app.api.routes.analyze import ALLOWED_AD_TYPES
from app.main import app


def _png_bytes(size: tuple[int, int] = (4, 4)) -> bytes:
    img = Image.new("RGB", size, "white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _orientation_6_jpeg_bytes() -> bytes:
    image = Image.new("RGB", (8, 4), "red")
    for x in range(4, 8):
        for y in range(4):
            image.putpixel((x, y), (0, 0, 255))
    exif = Image.Exif()
    exif[274] = 6
    buf = BytesIO()
    image.save(buf, format="JPEG", quality=100, subsampling=0, exif=exif)
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


def test_analyze_closes_uploaded_file_after_request() -> None:
    upload = UploadFile(file=BytesIO(_png_bytes()), filename="test.png")
    form = FormData([("file", upload), ("adType", "display_ad")])

    class RequestWithForm:
        async def form(self) -> FormData:
            return form

    response = asyncio.run(analyze_route.analyze(RequestWithForm()))  # type: ignore[arg-type]

    assert response.status_code == 200
    assert upload.file.closed is True


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


def test_analyze_applies_exif_orientation_before_analysis(monkeypatch: MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_run_analysis(**kwargs: object) -> dict[str, bool]:
        image = kwargs["image"]
        assert isinstance(image, Image.Image)
        captured["size"] = image.size
        captured["top_pixel"] = image.getpixel((1, 1))
        captured["bottom_pixel"] = image.getpixel((1, 6))
        return {"ok": True}

    monkeypatch.setattr(analyze_route, "run_analysis", fake_run_analysis)
    client = TestClient(app)

    res = client.post(
        "/analyze",
        files={"file": ("rotated.jpg", _orientation_6_jpeg_bytes(), "image/jpeg")},
        data={"adType": "display_ad"},
    )

    assert res.status_code == 200
    assert captured["size"] == (4, 8)
    top = captured["top_pixel"]
    bottom = captured["bottom_pixel"]
    assert isinstance(top, tuple) and top[0] > top[2]
    assert isinstance(bottom, tuple) and bottom[2] > bottom[0]
