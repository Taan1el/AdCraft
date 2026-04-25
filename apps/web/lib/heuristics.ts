// Browser-based heuristic ad analyzer.
// Runs client-side using the Canvas API. No model, no API key — just measurements
// from the actual pixels: whitespace, edge density (Sobel), contrast between dominant
// colors, and a rough saliency proxy for the CTA region.
//
// This produces honest, deterministic scores. It's not as smart as an LLM critique,
// but the numbers actually mean something.

import type {
  AdType,
  AnalysisResponse,
  CategoryScores,
  Issue,
  Recommendation,
} from "@adcraft/shared-types";

type RGB = { r: number; g: number; b: number };

type Metrics = {
  whitespaceRatio: number;
  visualDensity: number;
  contrastScore: number;
  ctaSaliencyScore: number;
  width: number;
  height: number;
  aspectRatio: number;
  brightnessMean: number;
  brightnessStd: number;
  paletteSize: number;
  topRegionDensity: number;
  bottomRegionDensity: number;
};

const MAX_DIM = 800; // downsample large uploads — keeps Sobel fast

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = url;
    });
    return img;
  } finally {
    // revoke after the image has actually loaded into memory
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function drawToCanvas(img: HTMLImageElement): { data: ImageData; width: number; height: number } {
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h), width: w, height: h };
}

// WCAG relative luminance
function luminance({ r, g, b }: RGB): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// quantize to a small palette by snapping each channel to 32-step buckets
function dominantPalette(d: ImageData, topN = 5): { color: RGB; count: number }[] {
  const counts = new Map<number, number>();
  const px = d.data;
  for (let i = 0; i < px.length; i += 16) {
    // sample every 4th pixel — fast enough and the palette barely changes
    const r = px[i] & 0xe0;
    const g = px[i + 1] & 0xe0;
    const b = px[i + 2] & 0xe0;
    const key = (r << 16) | (g << 8) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, count]) => ({
      color: { r: (key >> 16) & 0xff, g: (key >> 8) & 0xff, b: key & 0xff },
      count,
    }));
}

function sobelEdgeRatio(d: ImageData): { ratio: number; topRatio: number; bottomRatio: number } {
  const { width: w, height: h, data } = d;
  // grayscale buffer
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
  }
  let edges = 0;
  let topEdges = 0;
  let bottomEdges = 0;
  const halfH = h >> 1;
  // 3x3 Sobel
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] +
        gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      const mag = Math.abs(gx) + Math.abs(gy);
      if (mag > 80) {
        edges++;
        if (y < halfH) topEdges++;
        else bottomEdges++;
      }
    }
  }
  const total = (w - 2) * (h - 2);
  const halfTotal = total / 2;
  return {
    ratio: edges / total,
    topRatio: topEdges / halfTotal,
    bottomRatio: bottomEdges / halfTotal,
  };
}

function measureBrightness(d: ImageData): { mean: number; std: number; whitespace: number } {
  const px = d.data;
  let sum = 0;
  let sumSq = 0;
  let bright = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    const v = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    sum += v;
    sumSq += v * v;
    if (v > 0.92) bright++;
    n++;
  }
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  return { mean, std: Math.sqrt(variance), whitespace: bright / n };
}

// rough CTA saliency: how strongly the bottom third "pops" via saturated color + edges
function ctaSaliency(d: ImageData): number {
  const { width: w, height: h, data } = d;
  const yStart = Math.floor(h * 0.6);
  let satSum = 0;
  let n = 0;
  for (let y = yStart; y < h; y++) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      satSum += sat;
      n++;
    }
  }
  return n === 0 ? 0 : satSum / n;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function scoreFromTarget(value: number, idealMin: number, idealMax: number, falloff: number): number {
  if (value >= idealMin && value <= idealMax) return 100;
  const dist = value < idealMin ? idealMin - value : value - idealMax;
  return clamp(100 - (dist / falloff) * 100);
}

function aspectScore(adType: AdType, ratio: number): number {
  // ideal ratio per ad slot. Falloff is loose — we don't penalize hard.
  const targets: Record<AdType, [number, number]> = {
    display_ad: [1.5, 1.95],   // ~1.91:1 (Meta feed) or wider
    landing_hero: [1.6, 2.4],
    email_hero: [1.8, 3.5],
    social_ad: [0.8, 1.25],     // square-ish
  };
  const [lo, hi] = targets[adType];
  return scoreFromTarget(ratio, lo, hi, 1.0);
}

async function computeMetrics(file: File): Promise<Metrics> {
  const img = await loadImage(file);
  const { data, width, height } = drawToCanvas(img);

  const { mean, std, whitespace } = measureBrightness(data);
  const { ratio: density, topRatio, bottomRatio } = sobelEdgeRatio(data);
  const palette = dominantPalette(data, 5);

  // contrast = best contrast among the top-2 dominant colors
  let contrast = 1;
  if (palette.length >= 2) {
    contrast = contrastRatio(palette[0].color, palette[1].color);
    for (let i = 0; i < palette.length; i++) {
      for (let j = i + 1; j < palette.length; j++) {
        const c = contrastRatio(palette[i].color, palette[j].color);
        if (c > contrast) contrast = c;
      }
    }
  }

  return {
    whitespaceRatio: whitespace,
    visualDensity: density,
    contrastScore: contrast,
    ctaSaliencyScore: ctaSaliency(data),
    width,
    height,
    aspectRatio: width / Math.max(1, height),
    brightnessMean: mean,
    brightnessStd: std,
    paletteSize: palette.length,
    topRegionDensity: topRatio,
    bottomRegionDensity: bottomRatio,
  };
}

function deriveScores(m: Metrics, adType: AdType): CategoryScores {
  // visual hierarchy: top-vs-bottom density imbalance is good (means there's a focal area)
  const hierarchyDelta = Math.abs(m.topRegionDensity - m.bottomRegionDensity);
  const visualHierarchy = clamp(40 + hierarchyDelta * 600 + m.brightnessStd * 80);

  // CTA prominence: saliency in lower region + reasonable contrast
  const contrastNorm = Math.min(1, m.contrastScore / 7); // 7:1 = AAA
  const ctaProminence = clamp(40 + m.ctaSaliencyScore * 70 + contrastNorm * 30);

  // copy clarity: hard to measure without OCR. Proxy: moderate density + high contrast + not cluttered.
  const densityPenalty = m.visualDensity > 0.18 ? (m.visualDensity - 0.18) * 300 : 0;
  const copyClarity = clamp(50 + contrastNorm * 50 - densityPenalty);

  // readability: WCAG contrast ratio is the primary driver.
  // 4.5:1 = AA body, 7:1 = AAA. <3:1 fails.
  let readability: number;
  if (m.contrastScore >= 7) readability = 95;
  else if (m.contrastScore >= 4.5) readability = 80;
  else if (m.contrastScore >= 3) readability = 60;
  else readability = clamp(20 + m.contrastScore * 10);

  // layout balance: whitespace in a healthy band + aspect ratio match
  const wsScore = scoreFromTarget(m.whitespaceRatio, 0.15, 0.45, 0.4);
  const aspect = aspectScore(adType, m.aspectRatio);
  const layoutBalance = clamp(wsScore * 0.6 + aspect * 0.4);

  // trust signals: hard without OCR. Proxy: moderate palette + balanced brightness (extreme = sketchy).
  const brightnessFit = scoreFromTarget(m.brightnessMean, 0.3, 0.75, 0.5);
  const trustSignals = clamp(50 + brightnessFit * 0.4 + (m.contrastScore >= 4.5 ? 15 : 0));

  return {
    visualHierarchy: Math.round(visualHierarchy),
    ctaProminence: Math.round(ctaProminence),
    copyClarity: Math.round(copyClarity),
    readability: Math.round(readability),
    layoutBalance: Math.round(layoutBalance),
    trustSignals: Math.round(trustSignals),
  };
}

function buildIssues(m: Metrics, scores: CategoryScores): Issue[] {
  const out: Issue[] = [];

  if (m.contrastScore < 4.5) {
    out.push({
      id: "contrast-low",
      category: "readability",
      severity: m.contrastScore < 3 ? "high" : "medium",
      title: `Contrast ratio is only ${m.contrastScore.toFixed(1)}:1`,
      description:
        "WCAG AA requires at least 4.5:1 for body text. Low contrast hurts comprehension and accessibility — especially on small mobile screens.",
    });
  }

  if (m.whitespaceRatio < 0.1) {
    out.push({
      id: "whitespace-low",
      category: "layoutBalance",
      severity: "medium",
      title: "Layout looks crowded",
      description: `Only ${(m.whitespaceRatio * 100).toFixed(0)}% of the canvas reads as breathing room. Cluttered creatives lose viewers in the first second of scroll.`,
    });
  } else if (m.whitespaceRatio > 0.6) {
    out.push({
      id: "whitespace-high",
      category: "layoutBalance",
      severity: "low",
      title: "Lots of empty space",
      description: "Could indicate an underused canvas — consider whether the focal area earns its scale.",
    });
  }

  if (m.visualDensity > 0.22) {
    out.push({
      id: "density-high",
      category: "visualHierarchy",
      severity: "medium",
      title: "Visual density is high",
      description:
        "Edge density is well above the comfortable range. Too many competing elements blur the focal point — viewers don't know where to look.",
    });
  }

  if (scores.ctaProminence < 60) {
    out.push({
      id: "cta-weak",
      category: "ctaProminence",
      severity: "high",
      title: "CTA doesn't pop",
      description:
        "The lower region lacks the color saturation and contrast that make a button feel clickable. Try a high-contrast accent color reserved exclusively for the CTA.",
    });
  }

  if (Math.abs(m.topRegionDensity - m.bottomRegionDensity) < 0.02) {
    out.push({
      id: "hierarchy-flat",
      category: "visualHierarchy",
      severity: "medium",
      title: "No clear focal area",
      description:
        "Top and bottom halves carry roughly equal visual weight, so the eye has nowhere to land first. Strong creatives have an obvious hero element.",
    });
  }

  return out;
}

function buildRecommendations(m: Metrics, scores: CategoryScores): Recommendation[] {
  const out: Recommendation[] = [];

  if (m.contrastScore < 7) {
    out.push({
      id: "boost-contrast",
      category: "readability",
      priority: m.contrastScore < 4.5 ? "high" : "medium",
      title: "Increase text-to-background contrast",
      action:
        "Aim for 7:1 (WCAG AAA) on headlines. Darken the background behind text, or add a subtle scrim if the photo is busy.",
    });
  }

  if (scores.ctaProminence < 75) {
    out.push({
      id: "stronger-cta",
      category: "ctaProminence",
      priority: "high",
      title: "Make the CTA the brightest thing in the lower half",
      action:
        "Use one accent color reserved only for the button. Increase the button height by 15–20% and add a clear action verb ('Start free trial', 'Get the report').",
    });
  }

  if (m.visualDensity > 0.18) {
    out.push({
      id: "reduce-clutter",
      category: "visualHierarchy",
      priority: "medium",
      title: "Cut secondary elements",
      action:
        "Try removing 1–2 visual elements. The clearest ads usually have a single hero image, a 5-9 word headline, and the CTA — nothing else competing.",
    });
  }

  if (m.whitespaceRatio < 0.15) {
    out.push({
      id: "add-padding",
      category: "layoutBalance",
      priority: "medium",
      title: "Add breathing room",
      action: "Increase padding around the headline and CTA. Negative space is what makes the focal element feel important.",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "ab-test",
      category: "ctaProminence",
      priority: "low",
      title: "Run an A/B test on the headline",
      action:
        "Scores look healthy. The next biggest lift usually comes from copy testing — try two distinct value-prop angles against your current headline.",
    });
  }

  return out;
}

function buildSummary(scores: CategoryScores, overall: number): string {
  const weakest = (Object.entries(scores) as [keyof CategoryScores, number][])
    .sort((a, b) => a[1] - b[1])[0];
  const niceName: Record<keyof CategoryScores, string> = {
    visualHierarchy: "visual hierarchy",
    ctaProminence: "CTA prominence",
    copyClarity: "copy clarity",
    readability: "readability",
    layoutBalance: "layout balance",
    trustSignals: "trust signals",
  };
  const tier = overall >= 80 ? "strong" : overall >= 65 ? "decent" : overall >= 50 ? "mixed" : "weak";
  return `Heuristic analysis: ${tier} overall (${overall}/100). The biggest opportunity is ${niceName[weakest[0]]} at ${weakest[1]}/100. Scores derive from contrast, edge density, whitespace, and CTA-region saliency measured directly from the pixels — no AI critique was used.`;
}

export async function analyzeLocally(
  file: File,
  adType: AdType,
): Promise<AnalysisResponse> {
  const m = await computeMetrics(file);
  const scores = deriveScores(m, adType);

  const overall = Math.round(
    scores.visualHierarchy * 0.18 +
      scores.ctaProminence * 0.22 +
      scores.copyClarity * 0.15 +
      scores.readability * 0.20 +
      scores.layoutBalance * 0.15 +
      scores.trustSignals * 0.10,
  );

  const issues = buildIssues(m, scores);
  const recommendations = buildRecommendations(m, scores);

  return {
    analysisId: `local-${Date.now().toString(36)}`,
    image: { width: m.width, height: m.height },
    overallScore: overall,
    summary: buildSummary(scores, overall),
    categoryScores: scores,
    issues,
    recommendations,
    annotations: [],
    metrics: {
      whitespaceRatio: Number(m.whitespaceRatio.toFixed(3)),
      visualDensity: Number(m.visualDensity.toFixed(3)),
      contrastScore: Number(m.contrastScore.toFixed(2)),
      ctaSaliencyScore: Number(m.ctaSaliencyScore.toFixed(3)),
    },
  };
}
