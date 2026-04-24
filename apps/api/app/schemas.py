from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class AdType(str, Enum):
    display_ad = "display_ad"
    landing_hero = "landing_hero"
    email_hero = "email_hero"
    social_ad = "social_ad"


class CategoryScores(BaseModel):
    visualHierarchy: int = Field(ge=0, le=100)
    ctaProminence: int = Field(ge=0, le=100)
    copyClarity: int = Field(ge=0, le=100)
    readability: int = Field(ge=0, le=100)
    layoutBalance: int = Field(ge=0, le=100)
    trustSignals: int = Field(ge=0, le=100)


class Issue(BaseModel):
    id: str
    category: str
    severity: str
    title: str
    description: str


class Recommendation(BaseModel):
    id: str
    category: str
    priority: str
    title: str
    action: str


class Annotation(BaseModel):
    id: str
    type: str = "box"
    label: str
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    w: float = Field(gt=0.0, le=1.0)
    h: float = Field(gt=0.0, le=1.0)


class VisualMetrics(BaseModel):
    whitespaceRatio: float = Field(ge=0.0, le=1.0)
    visualDensity: float = Field(ge=0.0, le=1.0)
    contrastScore: float = Field(ge=0.0, le=1.0)
    ctaSaliencyScore: float = Field(ge=0.0, le=1.0)


class ImageMeta(BaseModel):
    width: int
    height: int


class AnalysisResponse(BaseModel):
    analysisId: str
    image: ImageMeta
    overallScore: int = Field(ge=0, le=100)
    summary: str
    categoryScores: CategoryScores
    issues: list[Issue]
    recommendations: list[Recommendation]
    annotations: list[Annotation]
    metrics: VisualMetrics


class LLMRefinement(BaseModel):
    summary: str
    categoryScores: CategoryScores
    issues: list[Issue]
    recommendations: list[Recommendation]
