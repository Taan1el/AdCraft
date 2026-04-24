/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";

import { analyzeCreative, DEMO_MODE } from "@/lib/api";
import { AdType, AnalysisResponse, CategoryScores } from "@/lib/types";

const AD_TYPES: Array<{ value: AdType; label: string; description: string }> = [
  { value: "landing_hero", label: "Landing hero", description: "Homepage hero, product page intro, or offer section." },
  { value: "display_ad", label: "Display ad", description: "Static banner or paid creative with a tight CTA." },
  { value: "social_ad", label: "Social ad", description: "Feed-first creative that needs immediate clarity." },
  { value: "email_hero", label: "Email hero", description: "Top-section email promo or campaign header." },
];

const CATEGORY_LABELS: Array<{ key: keyof CategoryScores; label: string }> = [
  { key: "visualHierarchy", label: "Visual Hierarchy" },
  { key: "ctaProminence", label: "CTA Prominence" },
  { key: "copyClarity", label: "Copy Clarity" },
  { key: "readability", label: "Readability" },
  { key: "layoutBalance", label: "Layout Balance" },
  { key: "trustSignals", label: "Trust Signals" },
];

const METRIC_LABELS: Record<string, string> = {
  whitespaceRatio: "Whitespace",
  visualDensity: "Visual Density",
  contrastScore: "Contrast",
  ctaSaliencyScore: "CTA Saliency",
};

export function AdCraftStudio() {
  const [adType, setAdType] = useState<AdType>("landing_hero");
  const [campaignGoal, setCampaignGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [brandName, setBrandName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectedAdType = useMemo(() => AD_TYPES.find((t) => t.value === adType), [adType]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) { setError("Upload a creative before running the analysis."); return; }
    try {
      setLoading(true);
      setError("");
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
    setFile(next);
    setAnalysis(null);
    setError("");
  }

  function scrollToUpload() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => uploadRef.current?.click(), 400);
  }

  function reset() {
    setFile(null);
    setAnalysis(null);
    setError("");
    setCampaignGoal("");
    setAudience("");
    setBrandName("");
  }

  if (analysis && previewUrl && !loading) {
    return <AnalysisView analysis={analysis} previewUrl={previewUrl} onReset={reset} />;
  }

  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      {DEMO_MODE && (
        <div style={{ background: "var(--blue)", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: "13px", fontWeight: 600 }}>
          Demo mode — scores are illustrative. Run the API locally for live analysis.
        </div>
      )}

      {/* Hero */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px 100px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 3.75rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 20px" }}>
            Transform Your Ad Creative with AI-Powered Insights
          </h1>
          <p style={{ fontSize: "1.0625rem", color: "var(--text-muted)", lineHeight: 1.7, margin: "0 0 36px", maxWidth: 460 }}>
            Get instant performance scores, actionable recommendations, and data-driven insights to make every ad creative count.
          </p>
          <button onClick={scrollToUpload} style={{ background: "var(--blue)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 28px", fontSize: "1rem", fontWeight: 700, cursor: "pointer", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--blue-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--blue)")}>
            Analyze Your Creative
          </button>
        </div>

        {/* Upload card */}
        <section ref={formRef}>
          <form onSubmit={handleSubmit}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: 24 }}>
              {/* Drop zone */}
              <label style={{ display: "block", cursor: "pointer" }}>
                <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleFileChange} />
                <div style={{ border: "2px dashed var(--border-dashed)", borderRadius: 14, padding: previewUrl ? 0 : "48px 24px", textAlign: "center", overflow: "hidden" }}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 12 }} />
                  ) : (
                    <>
                      <UploadIcon />
                      <div style={{ marginTop: 16 }}>
                        <span style={{ display: "inline-block", background: "var(--blue)", color: "#fff", borderRadius: 999, padding: "10px 24px", fontSize: "0.9rem", fontWeight: 700 }}>
                          Upload Image
                        </span>
                      </div>
                      <p style={{ margin: "12px 0 4px", color: "var(--text-subtle)", fontSize: "0.875rem" }}>or drop a file</p>
                      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.8rem" }}>PNG, JPG or WEBP</p>
                    </>
                  )}
                </div>
              </label>

              {file && (
                <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
                  <SelectField label="Asset type" value={adType} onChange={v => setAdType(v as AdType)}>
                    {AD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </SelectField>
                  <p style={{ margin: "0 0 4px", fontSize: "0.8rem", color: "var(--text-muted)" }}>{selectedAdType?.description}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <InputField label="Campaign goal" placeholder="Drive signups, increase CTR…" value={campaignGoal} onChange={setCampaignGoal} />
                    <InputField label="Audience" placeholder="Students, freelancers…" value={audience} onChange={setAudience} />
                  </div>
                  <InputField label="Brand name" placeholder="Optional" value={brandName} onChange={setBrandName} />
                </div>
              )}

              {error && (
                <div style={{ marginTop: 16, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: "0.875rem", color: "#fca5a5" }}>
                  {error}
                </div>
              )}

              {file && (
                <button type="submit" disabled={loading} style={{ marginTop: 16, width: "100%", background: loading ? "var(--surface-2)" : "var(--blue)", color: loading ? "var(--text-muted)" : "#fff", border: "none", borderRadius: 12, padding: "13px 24px", fontSize: "0.9375rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s" }}>
                  {loading ? "Analyzing…" : "Run Critique"}
                </button>
              )}
            </div>
          </form>
        </section>
      </section>

      {/* How It Works */}
      <section style={{ background: "var(--surface)", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 56px" }}>How It Works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 40, textAlign: "center" }}>
            {[
              { n: 1, title: "Upload Your Creative", body: "Simply drag and drop your ad creative or paste a link" },
              { n: 2, title: "AI Analysis", body: "Our AI evaluates design, messaging, and engagement potential" },
              { n: 3, title: "Get Actionable Insights", body: "Receive detailed scores and recommendations to optimize" },
            ].map(step => (
              <div key={step.n}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--blue)", color: "#fff", fontSize: "1.375rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  {step.n}
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 10px" }}>{step.title}</h3>
                <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 48px" }}>Powerful Features</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px 22px" }}>
                <div style={{ marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 10px" }}>{f.title}</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.65, margin: 0 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Analysis preview */}
      <section style={{ background: "var(--surface)", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.15, margin: "0 0 20px" }}>See Your Creative Score in Action</h2>
            <p style={{ fontSize: "1rem", color: "var(--text-muted)", lineHeight: 1.7, margin: "0 0 16px" }}>
              Our AI analyzes every aspect of your ad creative and provides a comprehensive breakdown of performance metrics.
            </p>
            <p style={{ fontSize: "1rem", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
              From visual appeal to message clarity, you'll get the insights you need to create high-performing ads.
            </p>
          </div>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 18, padding: 28 }}>
            {/* Circular score gauge */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
              <ScoreGauge score={84} />
            </div>
            {[
              { label: "Visual Appeal", value: 92 },
              { label: "Message Clarity", value: 78 },
              { label: "Call-to-Action", value: 85 },
            ].map(m => (
              <div key={m.label} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: "0.875rem", color: "var(--text-subtle)" }}>{m.label}</span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>{m.value}%</span>
                </div>
                <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 999 }}>
                  <div style={{ height: "100%", width: `${m.value}%`, background: "var(--blue)", borderRadius: 999 }} />
                </div>
              </div>
            ))}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {["Strong visual hierarchy", "Clear value prop", "High contrast"].map(tag => (
                <span key={tag} style={{ border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "5px 12px", fontSize: "0.8rem", color: "var(--text-subtle)" }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "100px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 32px" }}>Ready to Optimize Your Ad Creative?</h2>
        <button onClick={scrollToUpload} style={{ background: "var(--blue)", color: "#fff", border: "none", borderRadius: 12, padding: "16px 36px", fontSize: "1.0625rem", fontWeight: 700, cursor: "pointer", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--blue-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--blue)")}>
          Get Started Now
        </button>
      </section>
    </div>
  );
}

function AnalysisView({ analysis, previewUrl, onReset }: { analysis: AnalysisResponse; previewUrl: string; onReset: () => void }) {
  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--text-muted)" }}>Conversion Report</p>
            <h1 style={{ margin: 0, fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.03em" }}>Review Complete</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 24px", textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--text-muted)" }}>Overall</p>
              <p style={{ margin: 0, fontSize: "2.5rem", fontWeight: 800, lineHeight: 1 }}>{analysis.overallScore}</p>
            </div>
            <button onClick={onReset} style={{ background: "var(--surface)", color: "var(--text-subtle)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 18px", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
              ← New analysis
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Annotated preview */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                <p style={{ margin: 0, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--text-muted)" }}>Annotated Preview</p>
              </div>
              <div style={{ position: "relative" }}>
                <img src={previewUrl} alt="Annotated creative" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {analysis.annotations.map(a => (
                    <div key={a.id} style={{ position: "absolute", left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%`, border: "2px solid var(--blue)", borderRadius: 8, background: "rgba(77,124,254,0.12)" }}>
                      <span style={{ position: "absolute", top: 6, left: 6, background: "var(--blue)", color: "#fff", borderRadius: 4, padding: "2px 7px", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase" }}>{a.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: "12px 18px", fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.65 }}>{analysis.summary}</div>
            </div>

            {/* Category scores */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {CATEGORY_LABELS.map(c => (
                <div key={c.key} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 14px" }}>
                  <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: "var(--text-muted)" }}>{c.label}</p>
                  <p style={{ margin: "0 0 8px", fontSize: "1.875rem", fontWeight: 800, lineHeight: 1 }}>{analysis.categoryScores[c.key]}</p>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 999 }}>
                    <div style={{ height: "100%", width: `${analysis.categoryScores[c.key]}%`, background: "var(--blue)", borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Summary */}
            <Card label="Summary">
              <p style={{ margin: 0, fontSize: "0.9375rem", color: "var(--text-subtle)", lineHeight: 1.7 }}>{analysis.summary}</p>
            </Card>

            {/* Issues */}
            <Card label="Key Issues">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {analysis.issues.map(issue => (
                  <div key={issue.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700 }}>{issue.title}</p>
                      <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", color: "var(--text-muted)" }}>{issue.severity}</span>
                    </div>
                    <p style={{ margin: "0 0 4px", fontSize: "0.775rem", color: "var(--text-muted)", textTransform: "capitalize" }}>{issue.category.replace(/([A-Z])/g, " $1")}</p>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-subtle)", lineHeight: 1.65 }}>{issue.description}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recommendations */}
            <Card label="Recommended Fixes">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {analysis.recommendations.map(r => (
                  <div key={r.id} style={{ background: "rgba(77,124,254,0.08)", border: "1px solid rgba(77,124,254,0.2)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700 }}>{r.title}</p>
                      <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.12em", background: "var(--blue)", color: "#fff", borderRadius: 6, padding: "2px 8px" }}>{r.priority}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-subtle)", lineHeight: 1.65 }}>{r.action}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Metrics */}
            <Card label="Metric Snapshot">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {Object.entries(analysis.metrics).map(([key, value]) => (
                  <div key={key} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 14px" }}>
                    <p style={{ margin: "0 0 8px", fontSize: "0.8rem", color: "var(--text-muted)" }}>{METRIC_LABELS[key] ?? key}</p>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 999, marginBottom: 8 }}>
                      <div style={{ height: "100%", width: `${Math.round(value * 100)}%`, background: "var(--blue)", borderRadius: 999 }} />
                    </div>
                    <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{Math.round(value * 100)} / 100</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 20 }}>
      <p style={{ margin: "0 0 14px", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--text-muted)" }}>{label}</p>
      {children}
    </div>
  );
}

function InputField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: "0.875rem", color: "var(--text)", outline: "none", width: "100%" }} />
    </label>
  );
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: "0.875rem", color: "var(--text)", outline: "none" }}>
        {children}
      </select>
    </label>
  );
}

const FEATURES = [
  {
    title: "Creative Scoring",
    body: "Get an overall performance score based on visual appeal, clarity, and engagement metrics",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    title: "Instant Feedback",
    body: "Receive real-time analysis and recommendations in seconds",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    title: "Audience Targeting",
    body: "Understand how your creative resonates with different audience segments",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    title: "Performance Predictions",
    body: "AI-powered forecasting of CTR, engagement, and conversion potential",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  {
    title: "A/B Testing Insights",
    body: "Compare multiple creatives and identify the strongest performers",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Detailed Analytics",
    body: "Deep dive into design elements, copy effectiveness, and visual hierarchy",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

function ScoreGauge({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{ position: "relative", width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="120" height="120" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--blue)" strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>{score}</p>
        <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>/100</p>
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto", display: "block" }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
