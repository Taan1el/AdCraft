import type { AnalyzeInput } from "@/lib/analyze-input";
import type { AnalysisResponse, Annotation, CategoryScores, Issue, Recommendation } from "@/lib/types";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function medianGray(gray: Uint8Array): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const half = gray.length / 2;
  let c = 0;
  for (let v = 0; v < 256; v++) {
    c += hist[v];
    if (c >= half) return v;
  }
  return 0;
}

function pstdev(gray: Uint8Array): number {
  if (gray.length <= 1) return 0;
  let s = 0;
  for (let i = 0; i < gray.length; i++) s += gray[i];
  const m = s / gray.length;
  let v = 0;
  for (let i = 0; i < gray.length; i++) {
    const d = gray[i] - m;
    v += d * d;
  }
  return Math.sqrt(v / gray.length);
}

function idx(x: number, y: number, w: number): number {
  return y * w + x;
}

async function grayFromFile(
  file: File,
  maxSide: number,
): Promise<{ origW: number; origH: number; w: number; h: number; gray: Uint8Array }> {
  const bmp = await createImageBitmap(file);
  const origW = bmp.width;
  const origH = bmp.height;
  const scale = Math.min(1, maxSide / Math.max(origW, origH));
  const w = Math.max(1, Math.round(origW * scale));
  const h = Math.max(1, Math.round(origH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const data = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return { origW, origH, w, h, gray };
}

function computeMetrics(gray: Uint8Array, w: number, h: number) {
  const n = gray.length;
  const med = medianGray(gray);
  let nearMed = 0;
  for (let i = 0; i < n; i++) {
    if (Math.abs(gray[i] - med) < 10) nearMed++;
  }
  const whitespaceRatio = clamp01(nearMed / n);

  const stdev = pstdev(gray);
  const contrastScore = clamp01(stdev / 64);

  const thr = 18;
  let edgeLike = 0;
  let total = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const p = gray[idx(x, y, w)];
      const dx = Math.abs(gray[idx(x + 1, y, w)] - p);
      const dy = Math.abs(gray[idx(x, y + 1, w)] - p);
      if (dx + dy >= thr) edgeLike++;
      total++;
    }
  }
  const visualDensity = clamp01(edgeLike / Math.max(1, total));

  const gridY = 10;
  const gridX = 10;
  const cellH = Math.max(1, Math.floor(h / gridY));
  const cellW = Math.max(1, Math.floor(w / gridX));

  let bestCta = 0;
  let ctaBox = { x0: 0, y0: 0, bw: cellW, bh: cellH };
  let bestClutter = 0;
  let clutterBox = ctaBox;

  for (let gy = 0; gy < gridY; gy++) {
    for (let gx = 0; gx < gridX; gx++) {
      const y0 = gy * cellH;
      const x0 = gx * cellW;
      const y1 = Math.min(h, y0 + cellH);
      const x1 = Math.min(w, x0 + cellW);

      const patch: number[] = [];
      const sy = Math.max(1, Math.floor((y1 - y0) / 12));
      const sx = Math.max(1, Math.floor((x1 - x0) / 12));
      for (let yy = y0; yy < y1; yy += sy) {
        for (let xx = x0; xx < x1; xx += sx) {
          patch.push(gray[idx(xx, yy, w)]);
        }
      }
      if (patch.length >= 16) {
        const u8 = Uint8Array.from(patch);
        const localStd = pstdev(u8);
        const local = localStd / 64;
        const cy = (y0 + y1) / 2 / h;
        const cx = (x0 + x1) / 2 / w;
        const bias = (1 - Math.abs(cx - 0.5)) * (1 - Math.abs(cy - 0.7));
        const score = local * Math.max(0.2, bias);
        if (score > bestCta) {
          bestCta = score;
          ctaBox = { x0, y0, bw: x1 - x0, bh: y1 - y0 };
        }
      }

      let edgeLocal = 0;
      let totalLocal = 0;
      const sy2 = Math.max(1, Math.floor((y1 - y0) / 10));
      const sx2 = Math.max(1, Math.floor((x1 - x0) / 10));
      for (let yy = y0; yy < y1 - 1; yy += sy2) {
        for (let xx = x0; xx < x1 - 1; xx += sx2) {
          const p = gray[idx(xx, yy, w)];
          const dx = Math.abs(gray[idx(xx + 1, yy, w)] - p);
          const dy = Math.abs(gray[idx(xx, yy + 1, w)] - p);
          if (dx + dy >= thr) edgeLocal++;
          totalLocal++;
        }
      }
      if (totalLocal >= 12) {
        const dens = edgeLocal / totalLocal;
        if (dens > bestClutter) {
          bestClutter = dens;
          clutterBox = { x0, y0, bw: x1 - x0, bh: y1 - y0 };
        }
      }
    }
  }

  const ctaSaliencyScore = clamp01(bestCta * 1.2);

  const annotations: Annotation[] = [
    {
      id: "ann_cta_candidate",
      type: "box",
      label: "CTA candidate area",
      x: clamp01(ctaBox.x0 / w),
      y: clamp01(ctaBox.y0 / h),
      w: clamp01(ctaBox.bw / w),
      h: clamp01(ctaBox.bh / h),
    },
    {
      id: "ann_clutter",
      type: "box",
      label: "High visual density",
      x: clamp01(clutterBox.x0 / w),
      y: clamp01(clutterBox.y0 / h),
      w: clamp01(clutterBox.bw / w),
      h: clamp01(clutterBox.bh / h),
    },
  ];

  if (contrastScore < 0.45) {
    annotations.push({
      id: "ann_low_contrast",
      type: "box",
      label: "Possible low-contrast text area",
      x: 0.06,
      y: 0.06,
      w: 0.88,
      h: 0.24,
    });
  }

  return {
    metrics: {
      whitespaceRatio,
      visualDensity: visualDensity,
      contrastScore,
      ctaSaliencyScore,
    },
    annotations,
  };
}

function categoryFromMetrics(m: AnalysisResponse["metrics"]): CategoryScores {
  return {
    visualHierarchy: Math.round(Math.max(0, Math.min(100, 55 + 45 * (1 - m.visualDensity)))),
    ctaProminence: Math.round(Math.max(0, Math.min(100, 40 + 60 * m.ctaSaliencyScore))),
    copyClarity: 72,
    readability: Math.round(Math.max(0, Math.min(100, 45 + 55 * m.contrastScore))),
    layoutBalance: 70,
    trustSignals: 65,
  };
}

function overallFromMetrics(m: AnalysisResponse["metrics"]): number {
  const raw =
    100 *
    (0.25 * m.contrastScore +
      0.25 * (1 - m.visualDensity) +
      0.25 * m.whitespaceRatio +
      0.25 * m.ctaSaliencyScore);
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function buildIssuesAndRecs(m: AnalysisResponse["metrics"]): { issues: Issue[]; recommendations: Recommendation[] } {
  const issues: Issue[] = [];
  const recs: Recommendation[] = [];

  if (m.contrastScore < 0.45) {
    issues.push({
      id: "issue_contrast_low",
      category: "readability",
      severity: "high",
      title: "Low contrast",
      description: "Large flat regions or weak separation between text and background.",
    });
    recs.push({
      id: "rec_increase_contrast",
      category: "readability",
      priority: "high",
      title: "Boost contrast on key text",
      action: "Darken text or lighten the area behind it so the headline and CTA read clearly on mobile.",
    });
  }

  if (m.ctaSaliencyScore < 0.5) {
    issues.push({
      id: "issue_cta_weak",
      category: "ctaProminence",
      severity: "high",
      title: "CTA does not stand out",
      description: "Nothing in the lower area reads like a dominant action.",
    });
    recs.push({
      id: "rec_cta_separation",
      category: "ctaProminence",
      priority: "high",
      title: "Give the CTA more weight",
      action: "Increase size/contrast and add whitespace so the button is the obvious next click.",
    });
  }

  if (m.visualDensity > 0.55) {
    issues.push({
      id: "issue_density",
      category: "visualHierarchy",
      severity: "medium",
      title: "Busy layout",
      description: "Lots of edges packed together — hierarchy gets noisy fast.",
    });
    recs.push({
      id: "rec_simplify",
      category: "visualHierarchy",
      priority: "medium",
      title: "Remove one secondary element",
      action: "Pick a single focal point; demote extras with smaller type or lower contrast.",
    });
  }

  return { issues: issues, recommendations: recs };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function analyzeWithHeuristics(input: AnalyzeInput): Promise<AnalysisResponse> {
  const { origW, origH, w, h, gray } = await grayFromFile(input.file, 320);
  const { metrics, annotations } = computeMetrics(gray, w, h);
  const categoryScores = categoryFromMetrics(metrics);
  const overallScore = overallFromMetrics(metrics);
  const { issues, recommendations } = buildIssuesAndRecs(metrics);

  const ctxBits = [input.campaignGoal, input.audience, input.brandName].filter(Boolean).join(" · ");
  const summary =
    `Local scan (no API): heuristic scores from the image pixels (${input.adType.replace(/_/g, " ")}). ` +
    (ctxBits ? `Context you entered: ${ctxBits}. ` : "") +
    "Hook up the backend + an LLM key when you want deeper copy critique.";

  return {
    analysisId: newId(),
    image: { width: origW, height: origH },
    overallScore,
    summary,
    categoryScores,
    issues,
    recommendations,
    annotations,
    metrics,
  };
}
