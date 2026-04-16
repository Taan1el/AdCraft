from __future__ import annotations

import json


def build_prompt(*, ad_type: str, context: dict, base_response: dict) -> str:
    rubric = {
        "visualHierarchy": "Is there a clear primary focal point and reading order?",
        "ctaProminence": "Does the CTA stand out and feel like the obvious next action?",
        "copyClarity": "Is the message specific, benefit-led, and instantly understandable?",
        "readability": "Can key text be read quickly on mobile? (contrast, size, clutter)",
        "layoutBalance": "Is spacing intentional with clean alignment and grouping?",
        "trustSignals": "Are there credible cues (proof, clarity, safety, legitimacy)?",
    }

    payload = {
        "adType": ad_type,
        "context": context,
        "baseResponse": base_response,
        "rubric": rubric,
        "outputRules": {
            "format": "Return JSON only. No markdown, no trailing text.",
            "specificity": "No generic advice. Every issue/recommendation must reference a concrete element/region.",
            "annotations": "Use 0..1 normalized coordinates. 2–5 boxes max.",
        },
    }

    schema_example = {
        "analysisId": "string",
        "image": {"width": 0, "height": 0},
        "overallScore": 0,
        "summary": "string",
        "categoryScores": {
            "visualHierarchy": 0,
            "ctaProminence": 0,
            "copyClarity": 0,
            "readability": 0,
            "layoutBalance": 0,
            "trustSignals": 0,
        },
        "issues": [
            {
                "id": "string",
                "category": "string",
                "severity": "low|medium|high",
                "title": "string",
                "description": "string",
            }
        ],
        "recommendations": [
            {
                "id": "string",
                "category": "string",
                "priority": "low|medium|high",
                "title": "string",
                "action": "string",
            }
        ],
        "annotations": [
            {
                "id": "string",
                "type": "box",
                "label": "string",
                "x": 0.0,
                "y": 0.0,
                "w": 0.0,
                "h": 0.0,
            }
        ],
        "metrics": {
            "whitespaceRatio": 0.0,
            "visualDensity": 0.0,
            "contrastScore": 0.0,
            "ctaSaliencyScore": 0.0,
        },
    }

    return (
        "You are a conversion-focused creative reviewer for ads and landing hero sections.\n"
        "Return ONLY a single JSON object (no markdown) matching this shape exactly.\n"
        "Do not add extra keys.\n"
        "Copy `analysisId`, `image`, and `metrics` exactly from `baseResponse`.\n"
        "Be specific and actionable.\n\n"
        "OUTPUT JSON SHAPE EXAMPLE (types only):\n"
        + json.dumps(schema_example, ensure_ascii=False)
        + "\n\n"
        "INPUT (JSON):\n"
        + json.dumps(payload, ensure_ascii=False)
    )

