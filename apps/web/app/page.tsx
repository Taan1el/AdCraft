"use client";

import { AnnotatedPreview } from "@/components/analysis/AnnotatedPreview";
import { CategoryScores } from "@/components/analysis/CategoryScores";
import { IssuesList } from "@/components/analysis/IssuesList";
import { RecommendationsList } from "@/components/analysis/RecommendationsList";
import { ScoreCard } from "@/components/analysis/ScoreCard";
import { SummaryPanel } from "@/components/analysis/SummaryPanel";
import { AdTypeSelect } from "@/components/upload/AdTypeSelect";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { analyzeCreative } from "@/lib/api";
import type { AdType, AnalysisResponse } from "@/lib/types";
import { formatPct01 } from "@/lib/utils";
import { useMemo, useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [adType, setAdType] = useState<AdType>("display_ad");
  const [campaignGoal, setCampaignGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [brandName, setBrandName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const canAnalyze = !!file && !loading;

  const metricChips = useMemo(() => {
    if (!result) return [];
    return [
      { label: "Whitespace", value: formatPct01(result.metrics.whitespaceRatio) },
      { label: "Visual density", value: formatPct01(result.metrics.visualDensity) },
      { label: "Contrast", value: formatPct01(result.metrics.contrastScore) },
      { label: "CTA saliency", value: formatPct01(result.metrics.ctaSaliencyScore) },
    ];
  }, [result]);

  async function onAnalyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeCreative({
        file,
        adType,
        campaignGoal: campaignGoal.trim() || undefined,
        audience: audience.trim() || undefined,
        brandName: brandName.trim() || undefined,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyze failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-zinc-900" />
            <div className="text-sm font-semibold tracking-tight text-zinc-900">AdCraft AI</div>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Analyze creatives like a conversion reviewer.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600">
            Upload a creative. Get grounded scores, issues, and actionable fixes—plus a visual overlay
            to show where attention and hierarchy break down.
          </p>
        </header>

        <main className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <section className="lg:col-span-2 space-y-4">
            <UploadDropzone value={file} onChange={setFile} disabled={loading} />
            <AdTypeSelect value={adType} onChange={setAdType} />

            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-900">Context (optional)</div>
              <div className="mt-3 space-y-3">
                <Field label="Campaign goal" value={campaignGoal} onChange={setCampaignGoal} />
                <Field label="Audience" value={audience} onChange={setAudience} />
                <Field label="Brand name" value={brandName} onChange={setBrandName} />
              </div>
            </div>

            <button
              type="button"
              onClick={onAnalyze}
              disabled={!canAnalyze}
              className={[
                "w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition",
                canAnalyze ? "bg-zinc-900 hover:bg-zinc-800" : "bg-zinc-400",
              ].join(" ")}
            >
              {loading ? "Analyzing..." : "Analyze"}
            </button>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                {error}
              </div>
            ) : null}
          </section>

          <section className="lg:col-span-3 space-y-4">
            {result ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ScoreCard
                    label="Overall score"
                    score={result.overallScore}
                    hint="0–100, grounded in deterministic metrics (mock mode)"
                  />
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-sm font-semibold text-zinc-900">Deterministic signals</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {metricChips.map((c) => (
                        <div
                          key={c.label}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800"
                        >
                          {c.label}: <span className="tabular-nums">{c.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-zinc-500">
                      These metrics ground critique and reduce generic output.
                    </div>
                  </div>
                </div>

                <SummaryPanel summary={result.summary} />
                <CategoryScores scores={result.categoryScores} />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <IssuesList items={result.issues} />
                  <RecommendationsList items={result.recommendations} />
                </div>

                {file ? <AnnotatedPreview file={file} annotations={result.annotations} /> : null}
              </>
            ) : (
              <EmptyState />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-zinc-700">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
        placeholder="Optional"
      />
    </label>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-10">
      <div className="text-sm font-semibold text-zinc-900">Ready when you are</div>
      <p className="mt-2 text-sm leading-6 text-zinc-700">
        Upload a creative and click Analyze. You’ll get a structured report (scores, issues, fixes)
        plus an annotation overlay to make feedback easy to apply.
      </p>
    </div>
  );
}
