from __future__ import annotations

from dataclasses import dataclass
import statistics

from PIL import Image


@dataclass(frozen=True)
class Metrics:
    whitespace_ratio: float
    visual_density: float
    contrast_score: float
    cta_saliency_score: float


def _clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def _downsample_gray(image: Image.Image, max_side: int = 320) -> tuple[list[int], int, int]:
    gray = image.convert("L")
    w, h = gray.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1.0:
        gray = gray.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.BILINEAR)
    w2, h2 = gray.size
    pixels = list(gray.get_flattened_data())
    return pixels, w2, h2


def compute_deterministic_metrics(image: Image.Image) -> tuple[Metrics, list[dict]]:
    pixels, w, h = _downsample_gray(image)
    n = max(1, len(pixels))

    stdev = statistics.pstdev(pixels) if n > 1 else 0.0
    contrast_score = _clamp01(float(stdev / 64.0))

    med = statistics.median(pixels) if pixels else 0.0
    whitespace_ratio = _clamp01(sum(1 for p in pixels if abs(p - med) < 10) / n)

    def idx(x: int, y: int) -> int:
        return y * w + x

    edge_like = 0
    total = 0
    thr = 18
    for y in range(h - 1):
        for x in range(w - 1):
            p = pixels[idx(x, y)]
            dx = abs(pixels[idx(x + 1, y)] - p)
            dy = abs(pixels[idx(x, y + 1)] - p)
            if dx + dy >= thr:
                edge_like += 1
            total += 1
    visual_density = _clamp01(edge_like / max(1, total))

    grid_y = 10
    grid_x = 10
    cell_h = max(1, h // grid_y)
    cell_w = max(1, w // grid_x)

    best = 0.0
    best_box = (0, 0, cell_w, cell_h)
    for gy in range(grid_y):
        for gx in range(grid_x):
            y0 = gy * cell_h
            x0 = gx * cell_w
            y1 = min(h, y0 + cell_h)
            x1 = min(w, x0 + cell_w)

            patch: list[int] = []
            sy = max(1, (y1 - y0) // 12)
            sx = max(1, (x1 - x0) // 12)
            for yy in range(y0, y1, sy):
                for xx in range(x0, x1, sx):
                    patch.append(pixels[idx(xx, yy)])
            if len(patch) < 16:
                continue

            local_std = statistics.pstdev(patch) if len(patch) > 1 else 0.0
            local = float(local_std / 64.0)

            cy = (y0 + y1) / 2 / h
            cx = (x0 + x1) / 2 / w
            bias = (1.0 - abs(cx - 0.5)) * (1.0 - abs(cy - 0.7))
            score = local * max(0.2, bias)
            if score > best:
                best = score
                best_box = (x0, y0, x1 - x0, y1 - y0)

    cta_saliency_score = _clamp01(best * 1.2)

    bx, by, bw, bh = best_box
    annotations: list[dict] = [
        {
            "id": "ann_cta_candidate",
            "type": "box",
            "label": "CTA candidate area",
            "x": _clamp01(bx / w),
            "y": _clamp01(by / h),
            "w": _clamp01(bw / w),
            "h": _clamp01(bh / h),
        }
    ]

    best_clutter = 0.0
    clutter_box = best_box
    for gy in range(grid_y):
        for gx in range(grid_x):
            y0 = gy * cell_h
            x0 = gx * cell_w
            y1 = min(h, y0 + cell_h)
            x1 = min(w, x0 + cell_w)

            edge_like_local = 0
            total_local = 0
            sy = max(1, (y1 - y0) // 10)
            sx = max(1, (x1 - x0) // 10)
            for yy in range(y0, y1 - 1, sy):
                for xx in range(x0, x1 - 1, sx):
                    p = pixels[idx(xx, yy)]
                    dx = abs(pixels[idx(xx + 1, yy)] - p)
                    dy = abs(pixels[idx(xx, yy + 1)] - p)
                    if dx + dy >= thr:
                        edge_like_local += 1
                    total_local += 1

            if total_local < 12:
                continue

            dens = edge_like_local / total_local
            if dens > best_clutter:
                best_clutter = dens
                clutter_box = (x0, y0, x1 - x0, y1 - y0)

    cbx, cby, cbw, cbh = clutter_box
    annotations.append(
        {
            "id": "ann_clutter",
            "type": "box",
            "label": "High visual density",
            "x": _clamp01(cbx / w),
            "y": _clamp01(cby / h),
            "w": _clamp01(cbw / w),
            "h": _clamp01(cbh / h),
        }
    )

    if contrast_score < 0.45:
        annotations.append(
            {
                "id": "ann_low_contrast",
                "type": "box",
                "label": "Possible low-contrast text area",
                "x": 0.06,
                "y": 0.06,
                "w": 0.88,
                "h": 0.24,
            }
        )

    metrics = Metrics(
        whitespace_ratio=whitespace_ratio,
        visual_density=visual_density,
        contrast_score=contrast_score,
        cta_saliency_score=cta_saliency_score,
    )
    return metrics, annotations

