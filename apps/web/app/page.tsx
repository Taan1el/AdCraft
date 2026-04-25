"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeCreative } from "@/lib/api";
import type { AdType, AnalysisResponse } from "@/lib/types";

const FEATURES = [
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.6 4.8H16l-4.2 3 1.6 4.8L9 12l-4.4 2.6 1.6-4.8L2 6.8h5.4L9 2z" stroke="#3b82f6" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
    title: "Creative Scoring",
    desc: "Get an overall performance score based on visual appeal, clarity, and engagement metrics",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v4M9 12v4M2 9h4M12 9h4" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="9" r="3" stroke="#3b82f6" strokeWidth="1.5"/></svg>,
    title: "Instant Feedback",
    desc: "Receive real-time analysis and recommendations in seconds",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="#3b82f6" strokeWidth="1.5"/><circle cx="9" cy="9" r="3.5" stroke="#3b82f6" strokeWidth="1.5"/><circle cx="9" cy="9" r="1" fill="#3b82f6"/></svg>,
    title: "Audience Targeting",
    desc: "Understand how your creative resonates with different audience segments",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 14l4-5 3 3 3-6 4 5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    title: "Performance Predictions",
    desc: "AI-powered forecasting of CTR, engagement, and conversion potential",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="6" height="10" rx="1.5" stroke="#3b82f6" strokeWidth="1.4"/><rect x="10" y="4" width="6" height="10" rx="1.5" stroke="#3b82f6" strokeWidth="1.4"/><path d="M8 9h2" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round"/></svg>,
    title: "A/B Testing Insights",
    desc: "Compare multiple creatives and identify the strongest performers",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="14" height="14" rx="2" stroke="#3b82f6" strokeWidth="1.4"/><path d="M5 12l2.5-4 2.5 3 2-2.5 2 3.5" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    title: "Detailed Analytics",
    desc: "Deep-dive into image elements, copy effectiveness, and visual hierarchy",
  },
];

function scoreColor(v: number) {
  if (v >= 80) return "#3b82f6";
  if (v >= 60) return "#f59e0b";
  return "#f87171";
}

function Spinner({ size = 22 }: { size?: number }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="8" stroke="rgba(59,130,246,0.18)" strokeWidth="2.5" />
      <path d="M19 11a8 8 0 0 0-8-8" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
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
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const runAnalysis = useCallback(async (f: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await analyzeCreative({ file: f, adType });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [adType]);

  // Auto-analyze whenever a file is set (drop, picker, or programmatic).
  // Wrapping the setter ensures both code paths kick analysis off without an extra button.
  const acceptFile = useCallback((f: File) => {
    setFile(f);
    void runAnalysis(f);
  }, [runAnalysis]);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = ""; // allow re-picking the same file
  }, []);

  // Scroll results into view once they appear (or once loading starts so the spinner is visible).
  useEffect(() => {
    if (loading || result) {
      // small delay so the section has actually rendered before we scroll
      const t = window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      return () => window.clearTimeout(t);
    }
  }, [loading, result]);

  const showResultsSection = loading || !!result || !!error;

  return (
    <>
      <nav>
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <div className="nav-logo-mark">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2l1.8 4.2H14l-3.6 2.6 1.4 4.2L8 10.6l-3.8 2.4 1.4-4.2L2 6.2h4.2L8 2z" fill="#3b82f6"/>
              </svg>
            </div>
            <span className="nav-logo-text">Ad<span>Craft</span></span>
          </a>
          <div className="nav-links">
            <a href="#how-it-works" className="nav-link">How it works</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#demo" className="nav-link">Demo</a>
            {result || loading ? (
              <button type="button" className="btn btn-blue" onClick={reset}>Analyze Another</button>
            ) : (
              <button type="button" className="btn btn-blue" onClick={() => fileInputRef.current?.click()}>Get Started</button>
            )}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px" }}>
        <div className="hero" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div>
            <h1 className="hero-headline">Transform Your Ad Creative with AI-Powered Insights</h1>
            <p className="hero-sub">Get instant performance scores, actionable recommendations, and data-driven insights to make every ad creative count.</p>
            <button type="button" className="btn btn-blue-lg" onClick={() => fileInputRef.current?.click()}>Analyze Your Creative</button>
          </div>

          <div
            className={`upload-zone${dragOver ? " drag-over" : ""}`}
            onClick={() => { if (!loading) fileInputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) acceptFile(f);
            }}
          >
            {loading ? (
              <>
                <div className="upload-icon"><Spinner /></div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>Analyzing…</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{file?.name}</div>
              </>
            ) : file ? (
              <>
                <div className="upload-icon">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M4 12l5 5L18 6" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>{file.name}</div>
                <button
                  type="button"
                  className="btn"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 14px", fontSize: "0.82rem", color: "var(--text-dim)", marginTop: 4 }}
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                >
                  Remove
                </button>
                {error ? <p style={{ fontSize: "0.78rem", color: "#f87171", marginTop: 4 }}>{error}</p> : null}
              </>
            ) : (
              <>
                <div className="upload-icon">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M11 14V4M11 4L7 8M11 4l4 4" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 17v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <button type="button" className="btn btn-blue" style={{ marginTop: 4 }} onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  Upload Image
                </button>
                <p className="upload-hint">or drop a file<br /><span>PNG, JPG, or WebP</span></p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) acceptFile(f);
              // reset input value so re-selecting the same file still fires onChange
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {showResultsSection ? (
        <section ref={resultsRef} className="results-wrap" style={{ borderTop: "1px solid var(--border)" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 0" }}>
              <Spinner size={40} />
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>Analyzing your creative…</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Reading pixels, computing contrast and density</div>
            </div>
          ) : result ? (
            <AnalysisResultsInline result={result} onReset={reset} />
          ) : error ? (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#f87171", marginBottom: 4 }}>Analysis failed</div>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{error}</p>
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
              <div className="step-title">Upload Your Creative</div>
              <p className="step-desc">Simply drag and drop your ad creative or paste a link</p>
            </div>
            <div className="step-connector" />
            <div className="step">
              <div className="step-circle">2</div>
              <div className="step-title">AI Analysis</div>
              <p className="step-desc">Our AI evaluates design, messaging, and engagement potential</p>
            </div>
            <div className="step-connector" />
            <div className="step">
              <div className="step-circle">3</div>
              <div className="step-title">Get Actionable Insights</div>
              <p className="step-desc">Receive detailed scores and recommendations to optimize</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <h2 className="section-title">Powerful Features</h2>
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

      <div className="score-section-wrap" id="demo">
        <div className="score-section">
          <div>
            <h2 className="score-left-title">See Your Creative Score in Action</h2>
            <p className="score-left-desc" style={{ marginBottom: 14 }}>Our AI analyzes every aspect of your ad creative and provides a comprehensive breakdown of performance metrics.</p>
            <p className="score-left-desc">From visual appeal to message clarity, you&apos;ll get the insights you need to create high-performing ads.</p>
          </div>
          <div className="score-card">
            <div className="score-ring-wrap">
              <div style={{ position: "relative", width: 120, height: 120 }}>
                <svg className="ring-svg" width="120" height="120" viewBox="0 0 120 120">
                  <circle className="ring-track" cx="60" cy="60" r="50" />
                  <circle className="ring-fill" cx="60" cy="60" r="50" strokeDasharray="314.16" strokeDashoffset="53.4" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.05em", lineHeight: 1 }}>84</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.04em", marginTop: 2 }}>/100</span>
                </div>
              </div>
            </div>
            <div className="metric-row">
              {([["Visual Appeal", 62], ["Message Clarity", 76], ["Call to Action", 89]] as [string, number][]).map(([label, val]) => (
                <div key={label} className="metric-item">
                  <div className="metric-label-row">
                    <span className="metric-label">{label}</span>
                    <span className="metric-val">{val}%</span>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${val}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="tag-chips">
              <span className="tag-chip">Strong visual hierarchy</span>
              <span className="tag-chip">Clear value prop</span>
              <span className="tag-chip">High contrast</span>
            </div>
          </div>
        </div>
      </div>

      <section className="report-section">
        <h2 className="section-title" style={{ marginBottom: 48 }}>Sample Analysis Report</h2>
        <div className="report-card">
          <div className="report-top">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 100 }}>
              <div style={{ position: "relative", width: 96, height: 96 }}>
                <svg style={{ transform: "rotate(-90deg)" }} width="96" height="96" viewBox="0 0 96 96">
                  <circle fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" cx="48" cy="48" r="40"/>
                  <circle fill="none" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" cx="48" cy="48" r="40" strokeDasharray="251.3" strokeDashoffset="32.7"/>
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1 }}>87</span>
                  <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 500 }}>/100</span>
                </div>
              </div>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Overall</span>
            </div>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: 8, letterSpacing: "-0.02em" }}>Strong creative with one critical fix needed</div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 14 }}>Visual hierarchy and CTA prominence are excellent. The layout draws the eye efficiently to the offer. Primary concern: headline contrast on mobile falls below WCAG AA — a quick color adjustment will resolve it before launch.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["Whitespace 68%", "Visual density 54%", "Contrast 71%", "CTA saliency 91%"].map((chip) => (
                  <span key={chip} style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 9px", color: "var(--text-dim)" }}>{chip}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: "24px 0 28px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Category Scores</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
              {([["Visual hierarchy", 82, "#3b82f6"], ["CTA prominence", 91, "#3b82f6"], ["Copy clarity", 75, "#f59e0b"], ["Readability", 61, "#f87171"], ["Layout balance", 88, "#3b82f6"], ["Trust signals", 84, "#3b82f6"]] as [string, number, string][]).map(([label, val, color]) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-dim)" }}>{label}</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color }}>{val}</span>
                  </div>
                  <div className="score-bar-track"><div className="score-bar-fill" style={{ width: `${val}%`, background: color }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24, paddingTop: 24 }}>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>Issues</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {([["badge-high", "HIGH", "Headline contrast ratio 2.9:1 — fails WCAG AA at mobile sizes"], ["badge-med", "MED", "Body copy line-length exceeds 75 characters — reduce for faster scanning"], ["badge-low", "LOW", "Logo placement competes with product image for top-left attention zone"]] as [string, string, string][]).map(([cls, label, text]) => (
                  <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                    <span className={`badge ${cls}`} style={{ marginTop: 1 }}>{label}</span>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.55 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>Recommendations</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["Increase headline text color to #fff or darken background overlay by 20%", "Trim body copy to 2 lines max — move supporting detail to landing page", "Shift logo to bottom-right corner to reduce competition with hero image"].map((rec) => (
                  <div key={rec} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.55 }}>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="cta-footer">
        <h2 className="cta-footer-title">Ready to Optimize Your Ad Creative?</h2>
        <button type="button" className="btn btn-blue-xl" onClick={() => fileInputRef.current?.click()}>Get Started Now</button>
      </div>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "24px 32px", maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>AdCraft</span>
        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.2)" }}>© 2026 AdCraft AI. All rights reserved.</span>
      </footer>
    </>
  );
}

function AnalysisResultsInline({ result, onReset }: { result: AnalysisResponse; onReset: () => void }) {
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
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: 720, lineHeight: 1.6 }}>{result.summary}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 14, padding: "16px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.05em", lineHeight: 1 }}>{result.overallScore}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 500, marginTop: 4, letterSpacing: "0.04em" }}>OVERALL</div>
          </div>
          <button type="button" onClick={onReset} className="btn btn-blue">Analyze Another</button>
        </div>
      </div>

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
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Issues</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.issues.length === 0 ? (
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: 12 }}>No issues flagged.</div>
            ) : result.issues.map((issue) => (
              <div key={issue.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                <span className={`badge badge-${issue.severity === "high" ? "high" : issue.severity === "medium" ? "med" : "low"}`} style={{ marginTop: 1 }}>{issue.severity === "medium" ? "MED" : issue.severity.toUpperCase()}</span>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.55 }}>{issue.description}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Recommendations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.recommendations.map((rec) => (
              <div key={rec.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.55 }}>{rec.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
