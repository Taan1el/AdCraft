from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "assets" / "demo-images" / "sample.png"
    out.parent.mkdir(parents=True, exist_ok=True)

    img = Image.new("RGB", (1200, 628), "white")
    d = ImageDraw.Draw(img)
    d.rectangle((80, 80, 1120, 220), outline="black", width=4)
    d.text((100, 100), "Sample Headline", fill="black")
    d.rectangle((860, 420, 1120, 540), fill="#111111")
    d.text((920, 458), "CTA", fill="white")
    img.save(out)
    print(str(out))


if __name__ == "__main__":
    main()

