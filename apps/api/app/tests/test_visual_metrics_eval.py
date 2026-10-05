"""Discrimination ("evaluation set") tests for the deterministic metrics.

The sibling test_visual_metrics.py locks in *invariants* — bounds, determinism,
annotation shape, and that degenerate sizes don't crash. Those all stay green
even if a metric regressed to a constant: a scorer that always returned 0.5
would satisfy every one of them.

This suite instead pins the metrics' *discriminative power* — the property that
makes the analyzer worth running at all: that a high-contrast frame actually
scores higher contrast than a flat one, a busy frame denser than a clean one,
a sparse frame more whitespace than a noisy one, and that the CTA-saliency
heuristic rewards a salient block in the lower-centre region (where a call to
action belongs) over the same block up top. It is the small, synthetic start of
the "evaluation set of creatives" called out as a next step in the README, built
from generated images so it needs no binary fixtures.
"""
from __future__ import annotations

from PIL import Image

from app.services.visual_metrics import compute_deterministic_metrics


def _solid(size: tuple[int, int], color: tuple[int, int, int]) -> Image.Image:
    return Image.new("RGB", size, color)


def _split_halves(
    size: tuple[int, int], left: tuple[int, int, int], right: tuple[int, int, int]
) -> Image.Image:
    img = Image.new("RGB", size, left)
    w, h = size
    for y in range(h):
        for x in range(w // 2, w):
            img.putpixel((x, y), right)
    return img


def _noise(size: tuple[int, int]) -> Image.Image:
    # Deterministic per-pixel pseudo-noise: adjacent pixels differ sharply, so
    # the edge detector sees clutter everywhere.
    img = Image.new("RGB", size)
    w, h = size
    for y in range(h):
        for x in range(w):
            v = (x * 37 + y * 53) % 256
            img.putpixel((x, y), (v, (v * 3) % 256, (v * 7) % 256))
    return img


def _block(
    size: tuple[int, int], box: tuple[int, int, int, int]
) -> Image.Image:
    # White canvas with one solid black rectangle (x0, y0, x1, y1).
    img = Image.new("RGB", size, "white")
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        for x in range(x0, x1):
            img.putpixel((x, y), (0, 0, 0))
    return img


def test_contrast_score_separates_high_from_low_contrast() -> None:
    high, _ = compute_deterministic_metrics(
        _split_halves((240, 200), (0, 0, 0), (255, 255, 255))
    )
    low, _ = compute_deterministic_metrics(
        _split_halves((240, 200), (120, 120, 120), (135, 135, 135))
    )
    assert high.contrast_score > low.contrast_score


def test_visual_density_separates_busy_from_clean() -> None:
    busy, _ = compute_deterministic_metrics(_noise((200, 160)))
    clean, _ = compute_deterministic_metrics(_solid((200, 160), (255, 255, 255)))
    assert busy.visual_density > clean.visual_density


def test_whitespace_ratio_separates_sparse_from_busy() -> None:
    sparse, _ = compute_deterministic_metrics(_block((300, 250), (130, 110, 170, 140)))
    busy, _ = compute_deterministic_metrics(_noise((300, 250)))
    assert sparse.whitespace_ratio > busy.whitespace_ratio


def test_cta_candidate_box_tracks_lower_region_block_over_top_block() -> None:
    # Identical block, different vertical position. The CTA heuristic biases the
    # lower-centre of the frame (where a call to action belongs), so the
    # CTA-candidate box lands on the lower block and the top block, not the
    # reverse. The scalar saliency score saturates at 1.0 for a pure black/white
    # mark, so the box position — the heuristic's actual spatial output — is the
    # discriminating signal here.
    _, lower_ann = compute_deterministic_metrics(
        _block((400, 300), (160, 200, 240, 260))
    )
    _, top_ann = compute_deterministic_metrics(
        _block((400, 300), (160, 40, 240, 100))
    )

    def _cta_y_center(annotations: list[dict]) -> float:
        cta = next(a for a in annotations if a["id"] == "ann_cta_candidate")
        return cta["y"] + cta["h"] / 2

    lower_y = _cta_y_center(lower_ann)
    top_y = _cta_y_center(top_ann)
    # The lower block's candidate sits in the lower half, the top block's in the
    # upper half — the heuristic followed the mark down, it did not invent a
    # lower-region hotspot regardless of input.
    assert lower_y > 0.5 > top_y
    assert lower_y > top_y


def test_cta_saliency_beats_flat_image() -> None:
    marked, _ = compute_deterministic_metrics(_block((400, 300), (160, 200, 240, 260)))
    flat, _ = compute_deterministic_metrics(_solid((400, 300), (255, 255, 255)))
    assert marked.cta_saliency_score > flat.cta_saliency_score
