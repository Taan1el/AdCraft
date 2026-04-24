/* eslint-disable @next/next/no-img-element */
"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useMemo, useState } from "react";
import { analyzeCreative, DEMO_MODE } from "@/lib/api";
import { AdType, AnalysisResponse, CategoryScores } from "@/lib/types";

const AD_TYPES: Array<{ value: AdType; label: string; description: string }> = [
  { value: "landing_hero", label: "Landing hero", description: "Homepage hero, product page intro, or offer section." },
  { value: "display_ad",   label: "Display ad",   description: "Static banner or paid creative with a tight CTA." },
  { value: "social_ad",    label: "Social ad",    description: "Feed-first creative that needs immediate clarity." },
  { value: "email_hero",   label: "Email hero",   description: "Top-section email promo or campaign header." },
];

const CATEGORY_LABELS: Array<{ key: keyof CategoryScores; label: string }> = [
  { key: "visualHierarchy", label: "Visual hierarchy" },
  { key: "ctaProminence",   label: "CTA prominence"   },
  { key: "copyClarity",     label: "Copy clarity"      },
  { key: "readability",     label: "Readability"       },
  { key: "layoutBalance",   label: "Layout balance"    },
  { key: "trustSignals",    label: "Trust signals"     },
];

const METRIC_LABELS: Record<string, string> = {
  whitespaceRatio:  "Whitespace",
  visualDensity:    "Visual density",
  contrastScore:    "Contrast",
  ctaSaliencyScore: "CTA saliency",
};

function scoreColor(v: number) {
  return v >= 80 ? "var(--blue)" : v >= 60 ? "#f59e0b" : "#f87171";
}

export function AdCraftStudio() {
  const [adType,       setAdType]       = useState<AdType>("landing_hero");
  const [campaignGoal, setCampaignGoal] = useState("");
  const [audience,     setAudience]     = useState("");
  const [brandName,    setBrandName]    = useState("");
  const [file,         setFile]         = useState<File | null>(null);
  const [previewUrl,   setPreviewUrl]   = useState("");
  const [analysis,     setAnalysis]     = useState<AnalysisResponse | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectedAdType = useMemo(() => AD_TYPES.find(t => t.value === adType), [adType]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) { setError("Upload a creative before running the analysis."); return; }
    try {
      setLoading(true); setError("");
      const result = await analyzeCreative({ file, adType, campaignGoal: campaignGoal.trim(), audience: audience.trim(), brandName: brandName.trim() });
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    setFile(next); setAnalysis(null); setError("");
  }

  function scrollToUpload() {
    uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function reset() {
    setFile(null); setAnalysis(null); setError("");
    setCampaignGoal(""); setAudience(""); setBrandName("");
  }

  /* ── ANALYSIS RESULTS VIEW ── */
  if (analysis && previewUrl && !loading) {
    return <AnalysisResults analysis={analysis} previewUrl={previewUrl} onReset={reset} />;
  }

  /* ── LANDING PAGE ── */
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {DEMO_MODE && (
        <div style={{ background: "var(--blue)", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: "13px", fontWeight: 600 }}>
          Demo mode — scores are illustrative. Run the API locally for live analysis.
        </div>
      )}

      {/* NAV */}
      <nav>
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <div className="nav-logo-mark">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 13L8 3l5 10" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 10h6" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="nav-logo-text">AdCraft <span>AI</span></span>
          </a>
          <div className="nav-links">
            <a href="#how-it-works" className="nav-link">How it works</a>
            <a href="#features"     className="nav-link">Features</a>
            <a href="#demo"         className="nav-link">Demo</a>
            <button className="btn btn-blue" onClick={scrollToUpload}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px" }}>
        <div className="hero" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div>
            <h1 className="hero-headline">Transform Your Ad Creative with AI-Powered Insights</h1>
            <p className="hero-sub">Get instant performance scores, actionable recommendations, and data-driven insights to make every ad creative count.</p>
            <button className="btn btn-blue-lg" onClick={scrollToUpload}>Analyze Your Creative</button>
          </div>

          {/* Upload zone */}
          <div ref={uploadRef}>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={handleFileChange} />
            {!file ? (
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                <div className="upload-icon">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M11 14V4M11 4L7 8M11 4l4 4" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 17v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <button className="btn btn-blue" style={{ marginTop: 4 }} onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>Upload Image</button>
                <p className="upload-hint">or drop a file<br/><span>paste image or URL</span></p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                  <img src={previewUrl} alt="Preview" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 10 }} />

                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Asset type</span>
                    <select value={adType} onChange={e => setAdType(e.target.value as AdType)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: "0.85rem", color: "var(--text)", outline: "none" }}>
                      {AD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label} — {t.description}</option>)}
                    </select>
                  </label>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <FieldInput label="Campaign goal" placeholder="Drive signups, CTR…" value={campaignGoal} onChange={setCampaignGoal} />
                    <FieldInput label="Audience"      placeholder="Students, freelancers…" value={audience}     onChange={setAudience} />
                  </div>
                  <FieldInput label="Brand name" placeholder="Optional" value={brandName} onChange={setBrandName} />

                  {error && (
                    <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: "0.82rem", color: "#f87171" }}>{error}</div>
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="submit" disabled={loading} className="btn btn-blue-lg" style={{ flex: 1, justifyContent: "center", opacity: loading ? 0.6 : 1 }}>
                      {loading ? "Analyzing…" : "Run Critique"}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={reset}>Clear</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
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

      {/* FEATURES */}
      <section id="features" className="section">
        <h2 className="section-title">Powerful Features</h2>
        <div className="features-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="feat-card">
              <div className="feat-icon-wrap">{f.icon}</div>
              <div className="feat-title">{f.title}</div>
              <p className="feat-desc">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SCORE PREVIEW */}
      <div id="demo" className="score-section-wrap">
        <div className="score-section">
          <div>
            <h2 className="score-left-title">See Your Creative Score in Action</h2>
            <p className="score-left-desc" style={{ marginBottom: 14 }}>Our AI analyzes every aspect of your ad creative and provides a comprehensive breakdown of performance metrics.</p>
            <p className="score-left-desc">From visual appeal to message clarity, you'll get the insights you need to create high-performing ads.</p>
          </div>
          <div className="score-card">
            <div className="score-ring-wrap">
              <div style={{ position: "relative", width: 120, height: 120 }}>
                <svg className="ring-svg" width="120" height="120" viewBox="0 0 120 120">
                  <circle className="ring-track" cx="60" cy="60" r="50"/>
                  <circle className="ring-fill" cx="60" cy="60" r="50" strokeDasharray="314.16" strokeDashoffset="53.4"/>
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.05em", lineHeight: 1 }}>84</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.04em", marginTop: 2 }}>/100</span>
                </div>
              </div>
            </div>
            <div className="metric-row">
              {[{ label: "Visual Appeal", val: 62 }, { label: "Message Clarity", val: 76 }, { label: "Call to Action", val: 89 }].map(m => (
                <div key={m.label} className="metric-item">
                  <div className="metric-label-row">
                    <span className="metric-label">{m.label}</span>
                    <span className="metric-val">{m.val}%</span>
                  </div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${m.val}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="tag-chips">
              {["Strong visual hierarchy", "Clear value prop", "High contrast"].map(t => <span key={t} className="tag-chip">{t}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* SAMPLE REPORT */}
      <section className="report-section">
        <h2 className="section-title" style={{ textAlign: "center", marginBottom: 48 }}>Sample Analysis Report</h2>
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
                {["Whitespace 68%", "Visual density 54%", "Contrast 71%", "CTA saliency 91%"].map(t => (
                  <span key={t} style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 9px", color: "var(--text-dim)" }}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Category scores */}
          <div style={{ padding: "24px 0 28px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Category Scores</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
              {[{ label: "Visual hierarchy", score: 82 }, { label: "CTA prominence", score: 91 }, { label: "Copy clarity", score: 75 }, { label: "Readability", score: 61 }, { label: "Layout balance", score: 88 }, { label: "Trust signals", score: 84 }].map(c => (
                <div key={c.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-dim)" }}>{c.label}</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: scoreColor(c.score) }}>{c.score}</span>
                  </div>
                  <div className="score-bar-track"><div className="score-bar-fill" style={{ width: `${c.score}%`, background: scoreColor(c.score) }} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* Issues + Recommendations */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24, paddingTop: 24 }}>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>Issues</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { sev: "HIGH", cls: "badge-high", text: "Headline contrast ratio 2.9:1 — fails WCAG AA at mobile sizes" },
                  { sev: "MED",  cls: "badge-med",  text: "Body copy line-length exceeds 75 characters — reduce for faster scanning" },
                  { sev: "LOW",  cls: "badge-low",  text: "Logo placement competes with product image for top-left attention zone" },
                ].map(i => (
                  <div key={i.sev + i.text} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                    <span className={`badge ${i.cls}`} style={{ marginTop: 1 }}>{i.sev}</span>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.55 }}>{i.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>Recommendations</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  "Increase headline text color to #fff or darken background overlay by 20%",
                  "Trim body copy to 2 lines max — move supporting detail to landing page",
                  "Shift logo to bottom-right corner to reduce competition with hero image",
                ].map(r => (
                  <div key={r} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.55 }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FOOTER */}
      <div className="cta-footer">
        <h2 className="cta-footer-title">Ready to Optimize Your Ad Creative?</h2>
        <button className="btn btn-blue-xl" onClick={scrollToUpload}>Get Started Now</button>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "24px 32px", maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 13L8 3l5 10" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 10h6" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>AdCraft AI</span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.2)" }}>© 2026 AdCraft AI. All rights reserved.</span>
      </footer>
    </div>
  );
}

/* ── ANALYSIS RESULTS ── */
function AnalysisResults({ analysis, previewUrl, onReset }: { analysis: AnalysisResponse; previewUrl: string; onReset: () => void }) {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <nav>
        <div className="nav-inner">
          <a href="#" className="nav-logo">
            <div className="nav-logo-mark">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 13L8 3l5 10" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 10h6" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="nav-logo-text">AdCraft <span>AI</span></span>
          </a>
          <button className="btn btn-ghost" onClick={onReset}>← New analysis</button>
        </div>
      </nav>

      <div className="results-wrap" style={{ paddingTop: 100 }}>
        <div className="report-card">
          {/* Header */}
          <div className="report-top">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 100 }}>
              <div style={{ position: "relative", width: 96, height: 96 }}>
                <svg style={{ transform: "rotate(-90deg)" }} width="96" height="96" viewBox="0 0 96 96">
                  <circle fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" cx="48" cy="48" r="40"/>
                  <circle fill="none" stroke={scoreColor(analysis.overallScore)} strokeWidth="8" strokeLinecap="round" cx="48" cy="48" r="40"
                    strokeDasharray="251.3" strokeDashoffset={`${251.3 - (analysis.overallScore / 100) * 251.3}`}/>
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1 }}>{analysis.overallScore}</span>
                  <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 500 }}>/100</span>
                </div>
              </div>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Overall</span>
            </div>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Conversion report</div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 14 }}>{analysis.summary}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(analysis.metrics).map(([k, v]) => (
                  <span key={k} style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 9px", color: "var(--text-dim)" }}>
                    {METRIC_LABELS[k] ?? k} {Math.round(v * 100)}%
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Category scores */}
          <div style={{ padding: "24px 0 28px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Category Scores</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
              {CATEGORY_LABELS.map(c => {
                const s = analysis.categoryScores[c.key];
                return (
                  <div key={c.key} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-dim)" }}>{c.label}</span>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: scoreColor(s) }}>{s}</span>
                    </div>
                    <div className="score-bar-track"><div className="score-bar-fill" style={{ width: `${s}%`, background: scoreColor(s) }} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Annotated preview + issues/recs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24, paddingTop: 24 }}>
            {/* Annotated image */}
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>Annotated Preview</div>
              <div style={{ position: "relative", borderRadius: 10, overflow: "hidden" }}>
                <img src={previewUrl} alt="Creative" style={{ width: "100%", display: "block" }} />
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {analysis.annotations.map(a => (
                    <div key={a.id} style={{ position: "absolute", left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%`, border: "2px solid var(--blue)", borderRadius: 6, background: "rgba(59,130,246,0.12)" }}>
                      <span style={{ position: "absolute", top: 4, left: 4, background: "var(--blue)", color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase" }}>{a.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Issues */}
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>Issues</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analysis.issues.map(i => (
                  <div key={i.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                    <span className={`badge ${i.severity === "high" ? "badge-high" : i.severity === "medium" ? "badge-med" : "badge-low"}`} style={{ marginTop: 1 }}>{i.severity.toUpperCase()}</span>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.55 }}>{i.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>Recommendations</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analysis.recommendations.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.55 }}>{r.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: "0.85rem", color: "var(--text)", outline: "none", width: "100%" }} />
    </label>
  );
}

const FEATURES = [
  { title: "Creative Scoring", body: "Get an overall performance score based on visual appeal, clarity, and engagement metrics", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2l1.6 4.8H16l-4.2 3 1.6 4.8L9 12l-4.4 2.6 1.6-4.8L2 6.8h5.4L9 2z" stroke="#3b82f6" strokeWidth="1.4" strokeLinejoin="round"/></svg> },
  { title: "Instant Feedback", body: "Receive real-time analysis and recommendations in seconds", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2v4M9 12v4M2 9h4M12 9h4" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="9" r="3" stroke="#3b82f6" strokeWidth="1.5"/></svg> },
  { title: "Audience Targeting", body: "Understand how your creative resonates with different audience segments", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="#3b82f6" strokeWidth="1.5"/><circle cx="9" cy="9" r="3.5" stroke="#3b82f6" strokeWidth="1.5"/><circle cx="9" cy="9" r="1" fill="#3b82f6"/></svg> },
  { title: "Performance Predictions", body: "AI-powered forecasting of CTR, engagement, and conversion potential", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 14l4-5 3 3 3-6 4 5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { title: "A/B Testing Insights", body: "Compare multiple creatives and identify the strongest performers", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="6" height="10" rx="1.5" stroke="#3b82f6" strokeWidth="1.4"/><rect x="10" y="4" width="6" height="10" rx="1.5" stroke="#3b82f6" strokeWidth="1.4"/><path d="M8 9h2" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round"/></svg> },
  { title: "Detailed Analytics", body: "Deep-dive into image elements, copy effectiveness, and visual hierarchy", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="14" height="14" rx="2" stroke="#3b82f6" strokeWidth="1.4"/><path d="M5 12l2.5-4 2.5 3 2-2.5 2 3.5" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
];
