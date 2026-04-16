from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.main import app

client = TestClient(app)


def make_test_image() -> BytesIO:
    image = Image.new("RGB", (1200, 800), "#F5F0E8")
    draw = ImageDraw.Draw(image)
    draw.rectangle((720, 540, 1010, 650), fill="#1F1812")
    draw.rectangle((710, 120, 1110, 320), fill="#D8C2A5")
    draw.text((90, 120), "Upgrade your workflow", fill="#201711")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["mode"] in {"mock", "hybrid"}


def test_analyze_returns_typed_payload() -> None:
    response = client.post(
        "/analyze",
        files={"file": ("creative.png", make_test_image(), "image/png")},
        data={"adType": "landing_hero", "campaignGoal": "Drive signups"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysisId"]
    assert payload["overallScore"] >= 0
    assert "categoryScores" in payload
    assert "annotations" in payload
    assert payload["image"]["width"] == 1200
