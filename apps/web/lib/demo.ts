import { AnalysisResponse } from "./types";

export function buildDemoResponse(): AnalysisResponse {
  return {
    analysisId: "demo-001",
    image: { width: 1200, height: 628 },
    overallScore: 71,
    summary:
      "The creative has a clear value proposition and readable headline, but the primary CTA lacks visual weight and competes with secondary copy. Whitespace distribution is uneven — the left third is dense while the right side is underused. Trust signals are absent, which will hurt conversion on cold traffic.",
    categoryScores: {
      visualHierarchy: 78,
      ctaProminence: 62,
      copyClarity: 76,
      readability: 82,
      layoutBalance: 65,
      trustSignals: 54,
    },
    issues: [
      {
        id: "i1",
        category: "ctaProminence",
        severity: "high",
        title: "CTA button is undersized and low-contrast",
        description:
          "The primary action button sits at 14 px with a mid-tone fill that blends into the background. Eye-tracking research consistently shows CTAs need to be the highest-contrast element below the headline to pull clicks.",
      },
      {
        id: "i2",
        category: "trustSignals",
        severity: "high",
        title: "No social proof or credibility markers",
        description:
          "Cold traffic has no reason to convert without proof. A star rating, customer count, or recognisable logo strip would reduce friction significantly — especially above the fold.",
      },
      {
        id: "i3",
        category: "layoutBalance",
        severity: "medium",
        title: "Left-heavy visual density",
        description:
          "Over 65 % of content is anchored in the left third of the frame. The right side is passive negative space rather than deliberate breathing room, which reads as incomplete rather than elegant.",
      },
      {
        id: "i4",
        category: "copyClarity",
        severity: "low",
        title: "Sub-headline introduces new concepts instead of reinforcing the headline",
        description:
          "The headline and sub-headline should form a single argument. Here the sub-headline pivots to a secondary benefit, splitting the reader's attention before they've committed to the primary hook.",
      },
    ],
    recommendations: [
      {
        id: "r1",
        category: "ctaProminence",
        priority: "high",
        title: "Increase CTA size and contrast",
        action:
          "Raise the button height to at least 48 px, use the brand's highest-contrast colour pairing, and add 8 px of horizontal padding on each side. The CTA should be the first element the eye lands on after the headline.",
      },
      {
        id: "r2",
        category: "trustSignals",
        priority: "high",
        title: "Add a social proof strip",
        action:
          "Place a single line of proof directly beneath the CTA: 'Trusted by 12,000+ marketers' or a row of five-star icons. Keep it to one line — more than that competes with the CTA.",
      },
      {
        id: "r3",
        category: "layoutBalance",
        priority: "medium",
        title: "Redistribute content to use the right third",
        action:
          "Move the product shot or a supporting visual into the right 30 % of the frame. This balances visual weight and gives the eye a natural left-to-right reading path that ends on the CTA.",
      },
    ],
    annotations: [
      { id: "a1", type: "box", label: "Weak CTA", x: 0.04, y: 0.68, w: 0.22, h: 0.18 },
      { id: "a2", type: "box", label: "No proof", x: 0.04, y: 0.88, w: 0.5, h: 0.09 },
      { id: "a3", type: "box", label: "Dead space", x: 0.72, y: 0.1, w: 0.26, h: 0.8 },
    ],
    metrics: {
      whitespaceRatio: 0.38,
      visualDensity: 0.62,
      contrastScore: 0.74,
      ctaSaliencyScore: 0.41,
    },
  };
}
