from __future__ import annotations

import base64
import io
import math
import os
import uuid
from dataclasses import dataclass
from typing import Iterable

from dotenv import load_dotenv
from PIL import Image, ImageOps, ImageStat

from app.schemas import (
    AdType,
    AnalysisResponse,
    Annotation,
    CategoryScores,
    ImageMeta,
    Issue,
    LLMRefinement,
    Recommendation,
    VisualMetrics,
)

load_dotenv()

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp"}


@dataclass
class AnalysisContext:
    metrics: VisualMetrics
    layout_balance_signal: float
    cta_box: tuple[float, float, float, float]
    dense_box: tuple[float, float, float, float]


def analyze_creative(
    *,
    file_bytes: bytes,
    content_type: str,
    ad_type: AdType,
    campaign_goal: str | None,
    audience: str | None,
    brand_name: str | None,
) -> AnalysisResponse:
    image = load_image(file_bytes=file_bytes, content_type=content_type)
    context = compute_analysis_context(image)
    base_result = build_rule_based_result(
        image=image,
        ad_type=ad_type,
        campaign_goal=campaign_goal,
        audience=audience,
        brand_name=brand_name,
        context=context,
    )
    return maybe_refine_with_llm(
        base_result=base_result,
        file_bytes=file_bytes,
        content_type=content_type,
        ad_type=ad_type,
        campaign_goal=campaign_goal,
        audience=audience,
        brand_name=brand_name,
        context=context,
    )


def load_image(*, file_bytes: bytes, content_type: str) -> Image.Image:
    if content_type not in ALLOWED_TYPES:
        raise ValueError("Unsupported file type. Use PNG, JPG, or WEBP.")

    if len(file_bytes) > 10 * 1024 * 1024:
        raise ValueError("Image is too large. Keep the file under 10 MB.")

    try:
        image = Image.open(io.BytesIO(file_bytes))
        image = ImageOps.exif_transpose(image).convert("RGB")
        return image
    except Exception as exc:  # pragma: no cover
        raise ValueError("Unable to read the uploaded image.") from exc


def compute_analysis_context(image: Image.Image) -> AnalysisContext:
    gray = ImageOps.autocontrast(image.convert("L").resize((128, 128)))
    hsv = image.convert("HSV").resize((96, 96))

    grayscale_pixels = list(gray.get_flattened_data())
    mean_luma = sum(grayscale_pixels) / len(grayscale_pixels)
    std_luma = math.sqrt(
        sum((pixel - mean_luma) ** 2 for pixel in grayscale_pixels) / len(grayscale_pixels)
    )

    contrast_score = clamp(std_luma / 74.0)
    whitespace_ratio = clamp(
        sum(1 for pixel in grayscale_pixels if pixel > 240) / len(grayscale_pixels)
    )
    visual_density = clamp(compute_density(gray))
    layout_balance_signal = clamp(compute_layout_balance(gray))
    cta_saliency_score, cta_box = detect_cta_signal(hsv)
    dense_box = detect_dense_region(gray)

    return AnalysisContext(
        metrics=VisualMetrics(
            whitespaceRatio=round(whitespace_ratio, 2),
            visualDensity=round(visual_density, 2),
            contrastScore=round(contrast_score, 2),
            ctaSaliencyScore=round(cta_saliency_score, 2),
        ),
        layout_balance_signal=round(layout_balance_signal, 2),
        cta_box=cta_box,
        dense_box=dense_box,
    )


def compute_density(gray: Image.Image) -> float:
    width, height = gray.size
    pixels = gray.load()
    total_delta = 0.0
    samples = 0

    for y in range(height - 1):
        for x in range(width - 1):
            current = pixels[x, y]
            total_delta += abs(current - pixels[x + 1, y])
            total_delta += abs(current - pixels[x, y + 1])
            samples += 2

    if samples == 0:
        return 0.0

    return clamp((total_delta / samples) / 92.0)


def compute_layout_balance(gray: Image.Image) -> float:
    width, height = gray.size
    quadrants = [
        gray.crop((0, 0, width / 2, height / 2)),
        gray.crop((width / 2, 0, width, height / 2)),
        gray.crop((0, height / 2, width / 2, height)),
        gray.crop((width / 2, height / 2, width, height)),
    ]
    means = [ImageStat.Stat(section).mean[0] for section in quadrants]
    left = (means[0] + means[2]) / 2
    right = (means[1] + means[3]) / 2
    top = (means[0] + means[1]) / 2
    bottom = (means[2] + means[3]) / 2

    left_right_gap = abs(left - right) / 255
    top_bottom_gap = abs(top - bottom) / 255
    return 1 - clamp((left_right_gap + top_bottom_gap) * 1.1)


def detect_cta_signal(hsv: Image.Image) -> tuple[float, tuple[float, float, float, float]]:
    grid = 6
    width, height = hsv.size
    cell_width = width // grid
    cell_height = height // grid
    best_score = 0.0
    best_cell = (grid // 2, grid - 2)
    full_pixels = list(hsv.get_flattened_data())
    full_vivid_ratio = vivid_ratio(full_pixels)

    for row in range(grid // 2, grid):
        for col in range(grid):
            box = (
                col * cell_width,
                row * cell_height,
                min((col + 1) * cell_width, width),
                min((row + 1) * cell_height, height),
            )
            cell_pixels = list(hsv.crop(box).get_flattened_data())
            cell_ratio = vivid_ratio(cell_pixels)
            value_boost = clamp((cell_ratio - full_vivid_ratio) + 0.45)
            center_pull = 1 - abs((col + 0.5) / grid - 0.62)
            score = (value_boost * 0.78) + (center_pull * 0.22)

            if score > best_score:
                best_score = score
                best_cell = (col, row)

    box = (
        best_cell[0] / grid,
        best_cell[1] / grid,
        1 / grid,
        1 / grid,
    )
    return clamp(best_score), box


def detect_dense_region(gray: Image.Image) -> tuple[float, float, float, float]:
    grid = 4
    width, height = gray.size
    cell_width = width // grid
    cell_height = height // grid
    best_score = -1.0
    best_cell = (1, 1)

    for row in range(grid):
        for col in range(grid):
            box = (
                col * cell_width,
                row * cell_height,
                min((col + 1) * cell_width, width),
                min((row + 1) * cell_height, height),
            )
            section = gray.crop(box)
            score = compute_density(section.resize((32, 32)))
            if score > best_score:
                best_score = score
                best_cell = (col, row)

    return (best_cell[0] / grid, best_cell[1] / grid, 1 / grid, 1 / grid)


def vivid_ratio(pixels: Iterable[tuple[int, int, int]]) -> float:
    materialized = list(pixels)
    if not materialized:
        return 0.0

    vivid_count = 0
    for _, saturation, value in materialized:
        if saturation > 105 and value > 110:
            vivid_count += 1

    return vivid_count / len(materialized)


def build_rule_based_result(
    *,
    image: Image.Image,
    ad_type: AdType,
    campaign_goal: str | None,
    audience: str | None,
    brand_name: str | None,
    context: AnalysisContext,
) -> AnalysisResponse:
    metrics = context.metrics
    layout_balance = int(round(context.layout_balance_signal * 100))

    category_scores = CategoryScores(
        visualHierarchy=score_from_mix(
            0.34 * (1 - metrics.visualDensity)
            + 0.28 * metrics.contrastScore
            + 0.38 * metrics.ctaSaliencyScore
        ),
        ctaProminence=score_from_mix(metrics.ctaSaliencyScore),
        copyClarity=score_from_mix(
            0.42 * metrics.contrastScore
            + 0.33 * metrics.whitespaceRatio
            + 0.25 * (1 - metrics.visualDensity)
        ),
        readability=score_from_mix(
            0.7 * metrics.contrastScore + 0.3 * metrics.whitespaceRatio
        ),
        layoutBalance=layout_balance,
        trustSignals=score_from_mix(
            0.34 * context.layout_balance_signal
            + 0.33 * metrics.whitespaceRatio
            + 0.33 * metrics.contrastScore
        ),
    )

    issues, recommendations, annotations = build_feedback(
        ad_type=ad_type,
        category_scores=category_scores,
        context=context,
        brand_name=brand_name,
    )

    overall_score = round(
        (
            category_scores.visualHierarchy
            + category_scores.ctaProminence
            + category_scores.copyClarity
            + category_scores.readability
            + category_scores.layoutBalance
            + category_scores.trustSignals
        )
        / 6
    )

    summary = build_summary(
        ad_type=ad_type,
        overall_score=overall_score,
        category_scores=category_scores,
        campaign_goal=campaign_goal,
        audience=audience,
    )

    return AnalysisResponse(
        analysisId=str(uuid.uuid4()),
        image=ImageMeta(width=image.width, height=image.height),
        overallScore=overall_score,
        summary=summary,
        categoryScores=category_scores,
        issues=issues,
        recommendations=recommendations,
        annotations=annotations,
        metrics=metrics,
    )


def build_feedback(
    *,
    ad_type: AdType,
    category_scores: CategoryScores,
    context: AnalysisContext,
    brand_name: str | None,
) -> tuple[list[Issue], list[Recommendation], list[Annotation]]:
    issues: list[Issue] = []
    recommendations: list[Recommendation] = []
    annotations: list[Annotation] = []

    if category_scores.ctaProminence < 66:
        issues.append(
            Issue(
                id="issue_cta",
                category="ctaProminence",
                severity="high",
                title="CTA is not winning the visual fight",
                description=(
                    "The likely action zone is present, but it does not pull enough attention "
                    "relative to surrounding content."
                ),
            )
        )
        recommendations.append(
            Recommendation(
                id="rec_cta",
                category="ctaProminence",
                priority="high",
                title="Increase CTA separation",
                action=(
                    "Give the call-to-action more whitespace, stronger contrast, and a cleaner local area "
                    "so the next step reads instantly."
                ),
            )
        )
        annotations.append(annotation_from_box("ann_cta", "CTA zone", context.cta_box))

    if category_scores.readability < 68:
        issues.append(
            Issue(
                id="issue_readability",
                category="readability",
                severity="high",
                title="Readability is under pressure",
                description=(
                    "Contrast and spacing suggest that important messaging may be harder to scan at speed."
                ),
            )
        )
        recommendations.append(
            Recommendation(
                id="rec_readability",
                category="readability",
                priority="high",
                title="Simplify the text field",
                action=(
                    "Reduce visual competition around the headline or offer copy and raise the contrast between text and background."
                ),
            )
        )
        annotations.append(annotation_from_box("ann_density", "Busy region", context.dense_box))

    if category_scores.visualHierarchy < 68:
        issues.append(
            Issue(
                id="issue_hierarchy",
                category="visualHierarchy",
                severity="medium",
                title="The hierarchy feels compressed",
                description=(
                    "Primary and secondary elements are close in weight, so the eye has to work harder to decide what matters first."
                ),
            )
        )
        recommendations.append(
            Recommendation(
                id="rec_hierarchy",
                category="visualHierarchy",
                priority="medium",
                title="Create a clearer first-read path",
                action=(
                    "Push one message to dominate, demote supporting details, and use spacing to create a faster top-to-bottom scan."
                ),
            )
        )

    if category_scores.layoutBalance < 64:
        issues.append(
            Issue(
                id="issue_balance",
                category="layoutBalance",
                severity="medium",
                title="The composition leans unevenly",
                description=(
                    "The creative weight is distributed unevenly, which makes the design feel less controlled."
                ),
            )
        )
        recommendations.append(
            Recommendation(
                id="rec_balance",
                category="layoutBalance",
                priority="medium",
                title="Rebalance the frame",
                action=(
                    "Reduce crowding on the heavier side and make the visual path feel more intentional across the frame."
                ),
            )
        )

    if category_scores.trustSignals < 70 and ad_type in {AdType.landing_hero, AdType.email_hero}:
        issues.append(
            Issue(
                id="issue_trust",
                category="trustSignals",
                severity="low",
                title="Support cues are thin",
                description=(
                    "The structure leaves limited room for reinforcing proof, reassurance, or orientation signals."
                ),
            )
        )
        recommendations.append(
            Recommendation(
                id="rec_trust",
                category="trustSignals",
                priority="medium",
                title="Add one confidence-building cue",
                action=(
                    "Introduce a trust marker such as a proof stat, reassuring subcopy, or brand reinforcement near the primary action."
                ),
            )
        )

    if not issues:
        creative_name = brand_name or "This creative"
        issues.append(
            Issue(
                id="issue_minor",
                category="copyClarity",
                severity="low",
                title="The foundation is solid",
                description=(
                    f"{creative_name} already reads clearly. The next gains likely come from tighter message emphasis rather than a full redesign."
                ),
            )
        )
        recommendations.append(
            Recommendation(
                id="rec_minor",
                category="copyClarity",
                priority="low",
                title="Test one sharper promise",
                action=(
                    "Keep the layout stable and experiment with a more specific benefit-led line near the top of the creative."
                ),
            )
        )

    deduped_annotations: list[Annotation] = []
    seen_ids: set[str] = set()
    for annotation in annotations:
        if annotation.id not in seen_ids:
            deduped_annotations.append(annotation)
            seen_ids.add(annotation.id)

    return issues, recommendations, deduped_annotations


def build_summary(
    *,
    ad_type: AdType,
    overall_score: int,
    category_scores: CategoryScores,
    campaign_goal: str | None,
    audience: str | None,
) -> str:
    asset_label = {
        AdType.display_ad: "display ad",
        AdType.landing_hero: "landing hero",
        AdType.email_hero: "email hero",
        AdType.social_ad: "social ad",
    }[ad_type]

    strengths = []
    weaknesses = []

    if category_scores.visualHierarchy >= 72:
        strengths.append("the visual path is reasonably controlled")
    if category_scores.ctaProminence >= 72:
        strengths.append("the action area reads with urgency")
    if category_scores.readability >= 72:
        strengths.append("the message has workable readability")

    if category_scores.ctaProminence < 66:
        weaknesses.append("the CTA does not dominate enough")
    if category_scores.visualHierarchy < 68:
        weaknesses.append("the hierarchy feels compressed")
    if category_scores.readability < 68:
        weaknesses.append("contrast and spacing are slowing scan speed")

    strength_text = strengths[0] if strengths else "the structure has a usable foundation"
    weakness_text = weaknesses[0] if weaknesses else "the next gains are mostly refinement-level"
    context_bits = [bit for bit in [campaign_goal, audience] if bit]
    context_suffix = ""
    if context_bits:
        context_suffix = f" Given the stated context of {' for '.join(context_bits[:2])},"

    return (
        f"This {asset_label} scores {overall_score}/100. {strength_text}, but {weakness_text}."
        f"{context_suffix} the clearest improvement path is to simplify the first read and make the primary action easier to notice."
    )


def maybe_refine_with_llm(
    *,
    base_result: AnalysisResponse,
    file_bytes: bytes,
    content_type: str,
    ad_type: AdType,
    campaign_goal: str | None,
    audience: str | None,
    brand_name: str | None,
    context: AnalysisContext,
) -> AnalysisResponse:
    mock_mode = os.getenv("MOCK_ANALYSIS", "true").lower() == "true"
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini").strip() or "gpt-4.1-mini"

    if mock_mode or not api_key:
        return base_result

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        prompt = build_llm_prompt(
            ad_type=ad_type,
            campaign_goal=campaign_goal,
            audience=audience,
            brand_name=brand_name,
            base_result=base_result,
            context=context,
        )
        image_base64 = base64.b64encode(file_bytes).decode("utf-8")

        response = client.responses.parse(
            model=model,
            input=[
                {
                    "role": "system",
                    "content": (
                        "You are a conversion-focused creative reviewer. Refine the provided deterministic analysis, "
                        "stay specific to the image and metrics, and keep the recommendations concrete."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {
                            "type": "input_image",
                            "image_url": f"data:{content_type};base64,{image_base64}",
                        },
                    ],
                },
            ],
            text_format=LLMRefinement,
        )

        parsed = response.output_parsed
        if not parsed:
            return base_result

        return base_result.model_copy(
            update={
                "summary": parsed.summary,
                "categoryScores": parsed.categoryScores,
                "issues": parsed.issues or base_result.issues,
                "recommendations": parsed.recommendations or base_result.recommendations,
                "overallScore": round(
                    (
                        parsed.categoryScores.visualHierarchy
                        + parsed.categoryScores.ctaProminence
                        + parsed.categoryScores.copyClarity
                        + parsed.categoryScores.readability
                        + parsed.categoryScores.layoutBalance
                        + parsed.categoryScores.trustSignals
                    )
                    / 6
                ),
            }
        )
    except Exception:
        return base_result


def build_llm_prompt(
    *,
    ad_type: AdType,
    campaign_goal: str | None,
    audience: str | None,
    brand_name: str | None,
    base_result: AnalysisResponse,
    context: AnalysisContext,
) -> str:
    return f"""
Review this uploaded creative and refine the structured critique.

Asset type: {ad_type.value}
Campaign goal: {campaign_goal or "not provided"}
Audience: {audience or "not provided"}
Brand: {brand_name or "not provided"}

Deterministic metrics:
- whitespace ratio: {base_result.metrics.whitespaceRatio}
- visual density: {base_result.metrics.visualDensity}
- contrast score: {base_result.metrics.contrastScore}
- CTA saliency score: {base_result.metrics.ctaSaliencyScore}
- internal layout balance signal: {context.layout_balance_signal}

Current score breakdown:
- visual hierarchy: {base_result.categoryScores.visualHierarchy}
- CTA prominence: {base_result.categoryScores.ctaProminence}
- copy clarity: {base_result.categoryScores.copyClarity}
- readability: {base_result.categoryScores.readability}
- layout balance: {base_result.categoryScores.layoutBalance}
- trust signals: {base_result.categoryScores.trustSignals}

Current summary:
{base_result.summary}

Current issues:
{format_issues(base_result.issues)}

Current recommendations:
{format_recommendations(base_result.recommendations)}

Instructions:
- Stay specific to the uploaded visual.
- Do not invent pixel-perfect coordinates.
- Keep score values realistic and consistent with the metrics.
- Prefer short, direct product-language feedback over marketing fluff.
""".strip()


def format_issues(issues: list[Issue]) -> str:
    return "\n".join(
        f"- [{issue.severity}] {issue.category}: {issue.title} — {issue.description}"
        for issue in issues
    )


def format_recommendations(recommendations: list[Recommendation]) -> str:
    return "\n".join(
        f"- [{recommendation.priority}] {recommendation.category}: {recommendation.title} — {recommendation.action}"
        for recommendation in recommendations
    )


def annotation_from_box(
    annotation_id: str,
    label: str,
    box: tuple[float, float, float, float],
) -> Annotation:
    x, y, w, h = box
    return Annotation(id=annotation_id, label=label, x=x, y=y, w=w, h=h)


def score_from_mix(value: float) -> int:
    return int(round(clamp(value) * 100))


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))
