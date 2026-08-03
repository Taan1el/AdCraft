from __future__ import annotations

import pytest
from PIL import Image

from app.services.visual_metrics import Metrics, compute_deterministic_metrics


def _metric_values(m: Metrics) -> list[float]:
    return [m.whitespace_ratio, m.visual_density, m.contrast_score, m.cta_saliency_score]


def test_metrics_are_clamped_to_unit_interval() -> None:
    # A noisy image exercises every metric; all four must stay in [0, 1].
    img = Image.new("RGB", (240, 180))
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            v = (x * 37 + y * 53) % 256
            px[x, y] = (v, (v * 3) % 256, (v * 7) % 256)

    metrics, _ = compute_deterministic_metrics(img)
    for value in _metric_values(metrics):
        assert 0.0 <= value <= 1.0


def test_flat_image_is_low_contrast_low_density() -> None:
    # A solid fill has no edges and no contrast.
    img = Image.new("RGB", (300, 250), "white")
    metrics, annotations = compute_deterministic_metrics(img)

    assert metrics.contrast_score == 0.0
    assert metrics.visual_density == 0.0
    # Whitespace dominates a solid image.
    assert metrics.whitespace_ratio > 0.9
    # A flat image trips the low-contrast heuristic annotation.
    assert any(a["id"] == "ann_low_contrast" for a in annotations)


def test_annotations_have_expected_shape_and_normalized_bounds() -> None:
    img = Image.new("RGB", (400, 300), "white")
    # Add a high-contrast block so a CTA/clutter region is found.
    for y in range(200, 260):
        for x in range(40, 160):
            img.putpixel((x, y), (0, 0, 0))

    _, annotations = compute_deterministic_metrics(img)

    ids = {a["id"] for a in annotations}
    # The two structural annotations are always emitted.
    assert {"ann_cta_candidate", "ann_clutter"} <= ids

    for ann in annotations:
        assert ann["type"] == "box"
        assert isinstance(ann["label"], str) and ann["label"]
        for key in ("x", "y", "w", "h"):
            assert 0.0 <= ann[key] <= 1.0


def test_deterministic_for_same_input() -> None:
    img = Image.new("RGB", (200, 200), "white")
    for y in range(0, 200, 4):
        for x in range(200):
            img.putpixel((x, y), (0, 0, 0))

    first, first_ann = compute_deterministic_metrics(img)
    second, second_ann = compute_deterministic_metrics(img)

    assert _metric_values(first) == _metric_values(second)
    assert first_ann == second_ann


@pytest.mark.parametrize("size", [(1, 1), (1, 64), (64, 1), (2, 2), (320, 1)])
def test_degenerate_dimensions_do_not_crash(size: tuple[int, int]) -> None:
    # A 1px-tall banner or a tracking-pixel-sized upload collapses every loop
    # bound to zero and every denominator to one. The module's max(1, ...)
    # guards exist precisely for this; lock in that they still hold so a future
    # refactor cannot reintroduce a ZeroDivisionError or an empty-range crash.
    img = Image.new("RGB", size, "white")
    metrics, annotations = compute_deterministic_metrics(img)

    for value in _metric_values(metrics):
        assert 0.0 <= value <= 1.0
    # Structural annotations are emitted regardless of input size, with bounds
    # that never escape the unit square even when width or height is 1.
    ids = {a["id"] for a in annotations}
    assert {"ann_cta_candidate", "ann_clutter"} <= ids
    for ann in annotations:
        for key in ("x", "y", "w", "h"):
            assert 0.0 <= ann[key] <= 1.0
