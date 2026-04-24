type AdType = "display_ad" | "landing_hero" | "email_hero" | "social_ad";

type CategoryScores = {
  visualHierarchy: number;
  ctaProminence: number;
  copyClarity: number;
  readability: number;
  layoutBalance: number;
  trustSignals: number;
};

type Issue = {
  id: string;
  category: string;
  severity: "low" | "medium" | "high" | string;
  title: string;
  description: string;
};

type Recommendation = {
  id: string;
  category: string;
  priority: "low" | "medium" | "high" | string;
  title: string;
  action: string;
};

type Annotation = {
  id: string;
  type: "box";
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type AnalysisResponse = {
  analysisId: string;
  image: { width: number; height: number };
  overallScore: number;
  summary: string;
  categoryScores: CategoryScores;
  issues: Issue[];
  recommendations: Recommendation[];
  annotations: Annotation[];
  metrics: {
    whitespaceRatio: number;
    visualDensity: number;
    contrastScore: number;
    ctaSaliencyScore: number;
  };
};

declare const createImageBitmap:
  | undefined
  | ((blob: Blob) => Promise<{ width: number; height: number; close?: () => void }>);

type Env = {
  ALLOWED_ORIGINS?: string;
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

function allowedOrigins(env: Env): string[] {
  const raw = (env.ALLOWED_ORIGINS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function withCors(req: Request, env: Env, res: Response): Response {
  const origin = req.headers.get("origin");
  const allowed = allowedOrigins(env);
  const h = new Headers(res.headers);

  if (origin && (allowed.includes(origin) || allowed.includes("*"))) {
    h.set("access-control-allow-origin", origin);
    h.set("vary", "origin");
  }
  h.set("access-control-allow-methods", "GET,POST,OPTIONS");
  h.set("access-control-allow-headers", "content-type");
  return new Response(res.body, { status: res.status, headers: h });
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function stableId(prefix: string) {
  // Deterministic ID that looks random enough for UI keys.
  return `${prefix}_${Date.now().toString(36)}`;
}

async function getImageSize(file: File): Promise<{ width: number; height: number }> {
  try {
    // Workers runtime supports createImageBitmap in most environments.
    if (!createImageBitmap) return { width: 0, height: 0 };
    const bmp = await createImageBitmap(file);
    const { width, height } = bmp;
    bmp.close?.();
    return { width: width || 0, height: height || 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

function scoreFromHeuristics(input: {
  width: number;
  height: number;
  bytes: number;
  adType: AdType;
}) {
  const { width, height, bytes, adType } = input;

  const aspect = width && height ? width / height : 1;
  const megapixels = width && height ? (width * height) / 1_000_000 : 0;
  const sizePerMp = megapixels > 0 ? bytes / megapixels : bytes;

  // Heuristics (fast, no pixel inspection):
  // - Extremely small creatives usually look blurry and hurt readability.
  // - Extremely large files often suggest heavy imagery/complexity.
  // - Some ad types prefer different aspect ratios.
  const smallPenalty = width && height && (width < 600 || height < 400) ? 0.18 : 0;
  const hugePenalty = bytes > 2_500_000 ? 0.1 : 0;
  const densityHint = clamp01((sizePerMp - 400_000) / 800_000); // ~0 for simple, ~1 for heavy imagery

  let aspectPenalty = 0;
  if (adType === "email_hero") {
    aspectPenalty = aspect < 2.0 ? 0.08 : 0;
  } else if (adType === "landing_hero") {
    aspectPenalty = aspect < 1.3 ? 0.06 : 0;
  } else if (adType === "display_ad") {
    aspectPenalty = aspect < 1.2 ? 0.04 : 0;
  } else if (adType === "social_ad") {
    // Square/portrait OK; penalize very wide.
    aspectPenalty = aspect > 1.7 ? 0.06 : 0;
  }

  const readability = clamp01(0.78 - smallPenalty - densityHint * 0.08);
  const layoutBalance = clamp01(0.74 - aspectPenalty);
  const visualHierarchy = clamp01(0.76 - densityHint * 0.1);
  const ctaProminence = clamp01(0.7 - densityHint * 0.06);
  const copyClarity = clamp01(0.72 - smallPenalty * 0.6);
  const trustSignals = clamp01(0.68 - hugePenalty * 0.5);

  const overall =
    (visualHierarchy +
      ctaProminence +
      copyClarity +
      readability +
      layoutBalance +
      trustSignals) /
    6;

  return {
    categoryScores: {
      visualHierarchy: Math.round(visualHierarchy * 100),
      ctaProminence: Math.round(ctaProminence * 100),
      copyClarity: Math.round(copyClarity * 100),
      readability: Math.round(readability * 100),
      layoutBalance: Math.round(layoutBalance * 100),
      trustSignals: Math.round(trustSignals * 100),
    },
    overallScore: Math.round(overall * 100),
    metrics: {
      whitespaceRatio: clamp01(0.28 - densityHint * 0.12),
      visualDensity: clamp01(0.45 + densityHint * 0.4),
      contrastScore: clamp01(0.62 - densityHint * 0.08),
      ctaSaliencyScore: clamp01(0.55 - densityHint * 0.06),
    },
    densityHint,
    smallPenalty,
    aspectPenalty,
  };
}

function buildIssuesAndRecs(input: {
  scores: ReturnType<typeof scoreFromHeuristics>;
  adType: AdType;
  width: number;
  height: number;
}) {
  const { scores, adType, width, height } = input;
  const issues: AnalysisResponse["issues"] = [];
  const recommendations: AnalysisResponse["recommendations"] = [];

  if (width && height && (width < 600 || height < 400)) {
    issues.push({
      id: stableId("issue"),
      category: "readability",
      severity: "high",
      title: "Creative resolution is quite small",
      description:
        "Small creatives often make text hard to read and reduce perceived quality, especially on high-DPI screens.",
    });
    recommendations.push({
      id: stableId("rec"),
      category: "readability",
      priority: "high",
      title: "Export at a higher resolution",
      action:
        "Re-export the creative at least 1200px wide (or 2× your target placement) and keep body text large enough for mobile viewing.",
    });
  }

  if (scores.metrics.visualDensity > 0.78) {
    issues.push({
      id: stableId("issue"),
      category: "visualHierarchy",
      severity: "medium",
      title: "The layout may feel visually busy",
      description:
        "High visual density can weaken hierarchy: users don’t know where to look first and CTAs can get lost.",
    });
    recommendations.push({
      id: stableId("rec"),
      category: "visualHierarchy",
      priority: "medium",
      title: "Simplify the above-the-fold message",
      action:
        "Reduce competing elements: one headline, one supporting line, one CTA. Use more breathing room around the CTA.",
    });
  }

  if (adType === "email_hero" && scores.metrics.whitespaceRatio < 0.18) {
    issues.push({
      id: stableId("issue"),
      category: "layoutBalance",
      severity: "low",
      title: "Email heroes benefit from more padding",
      description:
        "Email clients compress layouts; tight spacing can hurt scanability and tap targets.",
    });
    recommendations.push({
      id: stableId("rec"),
      category: "layoutBalance",
      priority: "low",
      title: "Add safe padding and larger CTA",
      action:
        "Increase outer padding and ensure the CTA button is at least ~44px tall for touch.",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: stableId("rec"),
      category: "ctaProminence",
      priority: "medium",
      title: "Make the CTA unmistakable",
      action:
        "Use a single contrasting CTA style and keep it close to the primary message. Avoid multiple competing buttons.",
    });
  }

  return { issues, recommendations };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return withCors(req, env, new Response(null, { status: 204 }));
    }

    if (url.pathname === "/health" && req.method === "GET") {
      return withCors(req, env, json({ ok: true }));
    }

    if (url.pathname === "/analyze" && req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (!ct.toLowerCase().includes("multipart/form-data")) {
        return withCors(
          req,
          env,
          json({ error: "Expected multipart/form-data" }, { status: 400 })
        );
      }

      const form = await req.formData();
      const file = form.get("file");
      const adTypeRaw = form.get("adType");
      const adType = (typeof adTypeRaw === "string" ? adTypeRaw : "display_ad") as AdType;

      const isBlobLike = !!file && typeof file === "object" && typeof (file as any).arrayBuffer === "function";
      if (!isBlobLike) {
        return withCors(req, env, json({ error: "Missing file" }, { status: 400 }));
      }

      const f = file as any as File;
      const { width, height } = await getImageSize(f);
      const bytes = (f as any).size || 0;

      const scores = scoreFromHeuristics({ width, height, bytes, adType });
      const { issues, recommendations } = buildIssuesAndRecs({ scores, adType, width, height });

      const annotations: AnalysisResponse["annotations"] =
        width && height
          ? [
              {
                id: stableId("ann"),
                type: "box",
                label: "Primary focus",
                x: Math.round(width * 0.1),
                y: Math.round(height * 0.1),
                w: Math.round(width * 0.8),
                h: Math.round(height * 0.35),
              },
            ]
          : [];

      const response: AnalysisResponse = {
        analysisId: stableId("analysis"),
        image: { width, height },
        overallScore: scores.overallScore,
        summary:
          "This is a fast, no-card Cloudflare Worker backend. It returns a deterministic critique using lightweight heuristics (no heavy AI/image processing).",
        categoryScores: scores.categoryScores,
        issues,
        recommendations,
        annotations,
        metrics: scores.metrics,
      };

      return withCors(req, env, json(response));
    }

    return withCors(req, env, json({ error: "Not found" }, { status: 404 }));
  },
};

