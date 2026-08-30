NON_BLANK_STRING = {"type": "string", "pattern": r"\S"}


ANALYSIS_RESPONSE_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "analysisId",
        "image",
        "overallScore",
        "summary",
        "categoryScores",
        "issues",
        "recommendations",
        "annotations",
        "metrics",
    ],
    "properties": {
        "analysisId": {"type": "string"},
        "image": {
            "type": "object",
            "additionalProperties": False,
            "required": ["width", "height"],
            "properties": {"width": {"type": "integer"}, "height": {"type": "integer"}},
        },
        "overallScore": {"type": "integer", "minimum": 0, "maximum": 100},
        "summary": NON_BLANK_STRING,
        "categoryScores": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "visualHierarchy",
                "ctaProminence",
                "copyClarity",
                "readability",
                "layoutBalance",
                "trustSignals",
            ],
            "properties": {
                "visualHierarchy": {"type": "integer", "minimum": 0, "maximum": 100},
                "ctaProminence": {"type": "integer", "minimum": 0, "maximum": 100},
                "copyClarity": {"type": "integer", "minimum": 0, "maximum": 100},
                "readability": {"type": "integer", "minimum": 0, "maximum": 100},
                "layoutBalance": {"type": "integer", "minimum": 0, "maximum": 100},
                "trustSignals": {"type": "integer", "minimum": 0, "maximum": 100},
            },
        },
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "category", "severity", "title", "description"],
                "properties": {
                    "id": NON_BLANK_STRING,
                    "category": NON_BLANK_STRING,
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "title": NON_BLANK_STRING,
                    "description": NON_BLANK_STRING,
                },
            },
        },
        "recommendations": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "category", "priority", "title", "action"],
                "properties": {
                    "id": NON_BLANK_STRING,
                    "category": NON_BLANK_STRING,
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                    "title": NON_BLANK_STRING,
                    "action": NON_BLANK_STRING,
                },
            },
        },
        "annotations": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "type", "label", "x", "y", "w", "h"],
                "properties": {
                    "id": {"type": "string"},
                    "type": {"const": "box"},
                    "label": {"type": "string"},
                    "x": {"type": "number", "minimum": 0, "maximum": 1},
                    "y": {"type": "number", "minimum": 0, "maximum": 1},
                    "w": {"type": "number", "minimum": 0, "maximum": 1},
                    "h": {"type": "number", "minimum": 0, "maximum": 1},
                },
            },
        },
        "metrics": {
            "type": "object",
            "additionalProperties": False,
            "required": ["whitespaceRatio", "visualDensity", "contrastScore", "ctaSaliencyScore"],
            "properties": {
                "whitespaceRatio": {"type": "number", "minimum": 0, "maximum": 1},
                "visualDensity": {"type": "number", "minimum": 0, "maximum": 1},
                "contrastScore": {"type": "number", "minimum": 0, "maximum": 1},
                "ctaSaliencyScore": {"type": "number", "minimum": 0, "maximum": 1},
            },
        },
    },
}

