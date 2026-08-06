"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeCreative, isRemoteConfigured, type AnalyzeOutcome } from "@/lib/api";
import type { AdType } from "@/lib/types";
import { AuthMenu } from "@/components/AuthMenu";
import { useAuth } from "@/lib/auth-context";
import { saveAnalysis } from "@/lib/history";
import { formatPct01 } from "@/lib/utils";

// 6 truthful feature cards — each one maps to actual capability in the codebase.
const FEATURES = [
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 9h12M9 3v12" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/><rect x="2" y="2" width="14" height="14" rx="2" stroke="#3b82f6" strokeWidth="1.4"/></svg>,
    title: "WCAG contrast scoring",
    desc: "Measures text-vs-background contrast against WCAG AA / AAA thresholds using the dominant-color palette",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="3" fill="#3b82f6"/><circle cx="9" cy="9" r="7" stroke="#3b82f6" strokeWidth="1.4"/></svg>,
    title: "CTA prominence",
    desc: "Locates the lower-region saliency by saturation analysis — flags ads where the button doesn't pop against the rest of the canvas",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="2" y="3" width="14" height="5" rx="1.4" stroke="#3b82f6" strokeWidth="1.4"/><rect x="2" y="10" width="14" height="5" rx="1.4" stroke="#3b82f6" strokeWidth="1.4"/></svg>,
    title: "Layout balance",
    desc: "Compares top-half vs bottom-half edge density via Sobel to detect whether the eye has a clear focal area",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 4h12M3 9h12M3 14h7" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    title: "Copy & readability heuristics",
    desc: "Combines contrast, density, and whitespace ratio to estimate how easily a viewer can parse the message in the first second of scroll",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 9c1.5-3 4-4.5 6-4.5s4.5 1.5 6 4.5c-1.5 3-4 4.5-6 4.5S4.5 12 3 9z" stroke="#3b82f6" strokeWidth="1.4"/><circle cx="9" cy="9" r="2" fill="#3b82f6"/></svg>,
    title: "AI-powered critique",
    desc: "When a Gemini key is configured, a vision model reads the actual copy, branding, and offer — catches what pixel math can't",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4 13V6m4 7V3m4 10v-5m4 5V8" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    title: "Personal history",
    desc: "Sign in to save your analyses, compare scores across uploads, and see your average per category over time",
  },
];

function scoreColor(v: number) {
  if (v >= 80) return "#3b82f6";
  if (v >= 60) return "#f59e0b";
  return "#f87171";
}

function Spinner({ size = 22 }: { size?: number }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="rgba(59,130,246,0.18)" strokeWidth="2.5" />
      <path d="M19 11a8 8 0 0 0-8-8" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// Logo (no star — wordmark only).
function Logo() {
  return (
    <a href="./" className="nav-logo" aria-label="AdCraft home">
      <span className="nav-logo-text" style={{ fontSize: "1.05rem" }}>
        Ad<span>Craft</span>
      </span>
    </a>
  );
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [adType] = useState<AdType>("display_ad");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AnalyzeOutcome | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const remoteConfigured = isRemoteConfigured();

  // Revoke previous preview URL when it changes / on unmount.
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const { user } = useAuth();

  const runAnalysis = useCallback(async (f: File) => {
    setLoading(true);
    setError(null);
    setOutcome(null);
    try {
      const out = await analyzeCreative({ file: f, adType });
      setOutcome(out);
      if (user) {
        const source: "local" | "gemini" = out.source === "remote" ? "gemini" : "local";
        void saveAnalysis({ file: f, adType, result: out.result, source });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [adType, user]);

  const acceptFile = useCallback((f: File) => {
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    void runAnalysis(f);
  }, [runAnalysis]);

  const reset = useCallback(() => {
    setFile(null);
    setOutcome(null);
    setError(null);
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (loading || outcome) {
      const t = window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      return () => window.clearTimeout(t);
    }
  }, [loading, outcome]);

  const showResultsSection = loading || !!outcome || !!error;
  // Spinner copy depends on whether we're hitting the AI backend or local pixel math.
  const spinnerLine = remoteConfigured
    ? "Asking the AI to critique your creative…"
    : "Reading pixels — contrast, density, palette…";

  return (
    <>
      <nav>
        <div className="nav-inner">
          <Logo />
          <div className="nav-links nav-links-desktop">
            <a href="#how-it-works" className="nav-link">How it works</a>
            <a href="#features" className="nav-link">Features</a>
            {outcome || loading ? (
              <button type="button" className="btn btn-blue" onClick={reset}>Analyze Another</button>
            ) : (
              <button type="button" className="btn btn-blue" onClick={() => fileInputRef.current?.click()}>Get Started</button>
            )}
            <AuthMenu />
          </div>
          <button
            type="button"
            className="nav-hamburger"
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              {mobileNavOpen ? (
                <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              ) : (
                <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              )}
            </svg>
          </button>
        </div>
        {mobileNavOpen ? (
          <div className="nav-mobile-panel">
            <a href="#how-it-works" className="nav-link" onClick={() => setMobileNavOpen(false)}>How it works</a>
            <a href="#features" className="nav-link" onClick={() => setMobileNavOpen(false)}>Features</a>
            {outcome || loading ? (
              <button type="button" className="btn btn-blue" onClick={() => { reset(); setMobileNavOpen(false); }}>Analyze Another</button>
            ) : (
              <button type="button" className="btn btn-blue" onClick={() => { fileInputRef.current?.click(); setMobileNavOpen(false); }}>Get Started</button>
            )}
            <AuthMenu />
          </div>
        ) : null}
      </nav>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px" }}>
        <div className="hero" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div>
            <h1 className="hero-headline">Transform Your Ad Creative with AI-Powered Insights</h1>
            <p className="hero-sub">Get instant performance scores, actionable recommendations, and data-driven insights to make every ad creative count.</p>
          </div>

          <UploadZone
            dragOver={dragOver}
            loading={loading}
            file={file}
            previewUrl={previewUrl}
            error={error}
            onPick={() => { if (!loading) fileInputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) acceptFile(f);
            }}
            onRemove={reset}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) acceptFile(f);
              e.target.value = "";
            }}
            aria-label="Upload an ad image"
          />
        </div>
      </div>

      {showResultsSection ? (
        <section ref={resultsRef} className="results-wrap" style={{ borderTop: "1px solid var(--border)" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "40px 0 60px" }}>
              {previewUrl ? (
                <div style={{ position: "relative", width: "100%", maxWidth: 420, aspectRatio: "16/10", borderRadius: 14, overflow: "hidden", background: "#000", border: "1px solid var(--border)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.4)" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                    <Spinner size={40} />
                    <div style={{ fontSize: "0.85rem", color: "var(--text)", fontWeight: 600 }}>Analyzing…</div>
                  </div>
                </div>
              ) : (
                <Spinner size={40} />
              )}
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>Analyzing your creative…</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{spinnerLine}</div>
            </div>
          ) : outcome ? (
            <AnalysisResultsInline outcome={outcome} previewUrl={previewUrl} fileName={file?.name} onReset={reset} />
          ) : error ? (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#f87171", marginBottom: 4 }}>Analysis failed</div>
              <p style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>{error}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section id="how-it-works" style={{ background: "var(--bg2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "90px 32px" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <h2 className="section-title">How It Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-circle">1</div>
              <div className="step-title">Drop your creative</div>
              <p className="step-desc">PNG, JPG, or WebP — we accept what ad platforms accept</p>
            </div>
            <div className="step-connector" />
            <div className="step">
              <div className="step-circle">2</div>
              <div className="step-title">Pixel + AI analysis</div>
              <p className="step-desc">Local pixel math runs instantly. With an AI key configured, a vision model adds copy and branding critique.</p>
            </div>
            <div className="step-connector" />
            <div className="step">
              <div className="step-circle">3</div>
              <div className="step-title">Actionable fixes</div>
              <p className="step-desc">Receive prioritized issues and specific recommendations — not vague suggestions</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <h2 className="section-title">What it actually measures</h2>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feat-card">
              <div className="feat-icon-wrap">{f.icon}</div>
              <div className="feat-title">{f.title}</div>
              <p className="feat-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="cta-footer">
        <h2 className="cta-footer-title">Ready to Optimize Your Ad Creative?</h2>
        <button type="button" className="btn btn-blue-xl" onClick={() => fileInputRef.current?.click()}>Upload an ad</button>
      </div>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "24px 32px", maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-dim)" }}>AdCraft</span>
        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>© 2026 AdCraft AI. All rights reserved.</span>
      </footer>
    </>
  );
}

function UploadZone({
  dragOver, loading, file, previewUrl, error, onPick, onDragOver, onDragLeave, onDrop, onRemove,
}: {
  dragOver: boolean;
  loading: boolean;
  file: File | null;
  previewUrl: string | null;
  error: string | null;
  onPick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
}) {
  // Keyboard handler for the zone so non-mouse users can open the picker.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (loading) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick();
    }
  };
  return (
    <div
      className={`upload-zone${dragOver ? " drag-over" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={file ? `Selected ${file.name}. Press to choose a different file.` : "Upload an ad image"}
      onClick={onPick}
      onKeyDown={onKeyDown}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {loading ? (
        // During analysis, keep the thumbnail visible so the user sees what's
        // being looked at — much less anxiety than a blank spinner.
        previewUrl ? (
          <div style={{ position: "relative", width: "100%", maxWidth: 220, aspectRatio: "16/10", borderRadius: 10, overflow: "hidden", background: "#000" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.45)" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Spinner size={28} />
              <div style={{ fontSize: "0.78rem", color: "var(--text)", fontWeight: 600 }}>Analyzing…</div>
            </div>
          </div>
        ) : (
          <>
            <div className="upload-icon"><Spinner /></div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>Analyzing…</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{file?.name}</div>
          </>
        )
      ) : file ? (
        <>
          <div className="upload-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M4 12l5 5L18 6" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>{file.name}</div>
          <button
            type="button"
            className="btn"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 14px", fontSize: "0.82rem", color: "var(--text-dim)", marginTop: 4 }}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            Remove
          </button>
          {error ? <p style={{ fontSize: "0.78rem", color: "#f87171", marginTop: 4 }}>{error}</p> : null}
        </>
      ) : (
        <>
          <div className="upload-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M11 14V4M11 4L7 8M11 4l4 4" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 17v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <button type="button" className="btn btn-blue" style={{ marginTop: 4 }} onClick={(e) => { e.stopPropagation(); onPick(); }}>
            Upload Image
          </button>
          <p className="upload-hint">or drop a file<br /><span>PNG, JPG, or WebP</span></p>
        </>
      )}
    </div>
  );
}

function AnalysisResultsInline({
  outcome, previewUrl, fileName, onReset,
}: {
  outcome: AnalyzeOutcome;
  previewUrl: string | null;
  fileName?: string;
  onReset: () => void;
}) {
  const { result, fellBack, fallbackReason } = outcome;
  const cats = [
    { label: "Visual hierarchy", key: "visualHierarchy" },
    { label: "CTA prominence", key: "ctaProminence" },
    { label: "Copy clarity", key: "copyClarity" },
    { label: "Readability", key: "readability" },
    { label: "Layout balance", key: "layoutBalance" },
    { label: "Trust signals", key: "trustSignals" },
  ] as const;

  return (
    <>
      <div className="results-header">
        <div>
          <h2 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", marginBottom: 8 }}>Analysis Report</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", maxWidth: 720, lineHeight: 1.6 }}>{result.summary}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 14, padding: "16px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.05em", lineHeight: 1 }}>{result.overallScore}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 500, marginTop: 4, letterSpacing: "0.04em" }}>OVERALL</div>
          </div>
          <button type="button" onClick={onReset} className="btn btn-blue">Analyze Another</button>
        </div>
      </div>

      {fellBack ? (
        <div role="status" style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: "0.78rem", color: "#fbbf24", display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M8 7v3M8 12h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span>AI critique unavailable — fell back to local pixel analysis. {fallbackReason ? <span style={{ color: "var(--text-dim)" }}>({fallbackReason})</span> : null}</span>
        </div>
      ) : null}

      {previewUrl ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 360px) 1fr", gap: 24, marginBottom: 32, alignItems: "start" }} className="results-preview">
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={fileName ?? "Uploaded creative"}
              style={{ display: "block", width: "100%", height: "auto", borderRadius: 8, background: "#000" }}
            />
            {fileName ? (
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: 10, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fileName} · {result.image.width}×{result.image.height}
              </div>
            ) : null}
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Pixel metrics</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {[
                ["Whitespace", formatPct01(result.metrics.whitespaceRatio)],
                ["Visual density", formatPct01(result.metrics.visualDensity)],
                ["Contrast", `${result.metrics.contrastScore.toFixed(1)}:1`],
                ["CTA saliency", formatPct01(result.metrics.ctaSaliencyScore)],
              ].map(([label, val]) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginBottom: 32 }}>
        {cats.map(({ label, key }) => {
          const v = result.categoryScores[key];
          return (
            <div key={key} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-dim)" }}>{label}</span>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: scoreColor(v) }}>{v}</span>
              </div>
              <div className="score-bar-track"><div className="score-bar-fill" style={{ width: `${v}%`, background: scoreColor(v) }} /></div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 24 }}>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Issues</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.issues.length === 0 ? (
              <div style={{ fontSize: "0.82rem", color: "var(--text-dim)", padding: 12 }}>No issues flagged.</div>
            ) : result.issues.map((issue) => (
              <div key={issue.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                <span className={`badge badge-${issue.severity === "high" ? "high" : issue.severity === "medium" ? "med" : "low"}`} style={{ marginTop: 1 }}>{issue.severity === "medium" ? "MED" : issue.severity.toUpperCase()}</span>
                <span style={{ fontSize: "0.82rem", color: "var(--text-dim)", lineHeight: 1.55 }}>{issue.description}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Recommendations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.recommendations.map((rec) => (
              <div key={rec.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 5l2 2 4-4" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{ fontSize: "0.82rem", color: "var(--text-dim)", lineHeight: 1.55 }}>{rec.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
