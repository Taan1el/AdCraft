/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { analyzeCreative } from "@/lib/api";
import { AdType, AnalysisResponse, CategoryScores } from "@/lib/types";

const AD_TYPES: Array<{
  value: AdType;
  label: string;
  description: string;
}> = [
  {
    value: "landing_hero",
    label: "Landing hero",
    description: "Homepage hero, product page intro, or offer section.",
  },
  {
    value: "display_ad",
    label: "Display ad",
    description: "Static banner or paid creative with a tight CTA.",
  },
  {
    value: "social_ad",
    label: "Social ad",
    description: "Feed-first creative that needs immediate clarity.",
  },
  {
    value: "email_hero",
    label: "Email hero",
    description: "Top-section email promo or campaign header.",
  },
];

const CATEGORY_LABELS: Array<{
  key: keyof CategoryScores;
  label: string;
}> = [
  { key: "visualHierarchy", label: "Visual hierarchy" },
  { key: "ctaProminence", label: "CTA prominence" },
  { key: "copyClarity", label: "Copy clarity" },
  { key: "readability", label: "Readability" },
  { key: "layoutBalance", label: "Layout balance" },
  { key: "trustSignals", label: "Trust signals" },
];

const METRIC_LABELS: Record<string, string> = {
  whitespaceRatio: "Whitespace",
  visualDensity: "Density",
  contrastScore: "Contrast",
  ctaSaliencyScore: "CTA saliency",
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

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const selectedAdType = useMemo(
    () => AD_TYPES.find((type) => type.value === adType),
    [adType],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Upload a creative before running the analysis.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const nextAnalysis = await analyzeCreative({
        file,
        adType,
        campaignGoal: campaignGoal.trim(),
        audience: audience.trim(),
        brandName: brandName.trim(),
      });

      setAnalysis(nextAnalysis);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Analysis failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setAnalysis(null);
    setError("");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--color-paper)] text-[var(--color-ink)]">
      <div className="studio-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="studio-noise pointer-events-none absolute inset-0 opacity-35" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <header className="grid gap-8 rounded-[2rem] border border-black/10 bg-white/75 p-6 shadow-[0_25px_80px_rgba(31,24,18,0.08)] backdrop-blur md:grid-cols-[1.1fr_0.9fr] md:p-8">
          <div className="space-y-5">
            <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--color-muted)]">
              Conversion critique studio
            </span>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-display text-5xl leading-[0.95] tracking-[-0.04em] text-[var(--color-ink)] sm:text-6xl">
                AdCraft AI turns pretty creatives into accountable ones.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--color-muted)] sm:text-lg">
                Upload a banner, hero, or social ad and get a structured review of
                hierarchy, CTA pull, readability, and conversion friction. The
                output is built for iteration, not vague praise.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-[var(--color-muted)]">
              <Tag>Image-first critique</Tag>
              <Tag>Typed API contract</Tag>
              <Tag>Deterministic fallback</Tag>
              <Tag>Optional AI refinement</Tag>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-ink)] p-5 text-[var(--color-paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.22em] text-white/45">
                Review rubric
              </p>
              <p className="text-sm text-white/55">V1 scope</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {CATEGORY_LABELS.map((category) => (
                <div
                  key={category.key}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <p className="text-sm font-semibold text-white">{category.label}</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Structured score plus concrete issues and suggested fixes.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-[0.84fr_1.16fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[2rem] border border-black/10 bg-white/80 p-5 shadow-[0_30px_80px_rgba(31,24,18,0.07)] backdrop-blur md:p-6"
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-[var(--color-muted)]">
                  Creative intake
                </p>
                <h2 className="mt-2 font-display text-3xl tracking-[-0.03em]">
                  Feed the evaluator
                </h2>
              </div>
              <div className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-muted)]">
                {selectedAdType?.label}
              </div>
            </div>

            <label className="group flex cursor-pointer flex-col gap-4 rounded-[1.5rem] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-accent)] hover:bg-[#f4ede3]">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleFileChange}
              />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink)]">
                    Upload a single creative
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    PNG, JPG, or WEBP. Keep it to one strong frame.
                  </p>
                </div>
                <span className="rounded-full bg-[var(--color-accent)] px-3 py-1 text-sm font-semibold text-[var(--color-accent-ink)]">
                  Choose file
                </span>
              </div>

              <div className="relative overflow-hidden rounded-[1.25rem] border border-[var(--color-border)] bg-white/70">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Uploaded creative preview"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(199,131,55,0.17),_transparent_42%),linear-gradient(135deg,#fbf6ef,#efe6d7)] p-8 text-center">
                    <div className="space-y-3">
                      <p className="font-display text-3xl tracking-[-0.03em] text-[var(--color-ink)]">
                        Drag a creative here
                      </p>
                      <p className="mx-auto max-w-xs text-sm leading-6 text-[var(--color-muted)]">
                        The report will highlight pressure points instead of
                        dumping a wall of generic advice.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </label>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[var(--color-muted)]">
                  Asset type
                </span>
                <select
                  value={adType}
                  onChange={(event) => setAdType(event.target.value as AdType)}
                  className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)]"
                >
                  {AD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-[var(--color-muted)]">
                  {selectedAdType?.description}
                </span>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Campaign goal"
                  placeholder="Drive signups, increase CTR, announce an offer"
                  value={campaignGoal}
                  onChange={setCampaignGoal}
                />
                <Field
                  label="Audience"
                  placeholder="Students, freelancers, first-time buyers"
                  value={audience}
                  onChange={setAudience}
                />
              </div>

              <Field
                label="Brand name"
                placeholder="Optional, used to tailor the critique language"
                value={brandName}
                onChange={setBrandName}
              />
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-[#d77d73] bg-[#fff2ef] px-4 py-3 text-sm text-[#8b3a2f]">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-w-44 items-center justify-center rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-semibold text-[var(--color-paper)] transition hover:translate-y-[-1px] hover:bg-[#241b15] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Analyzing creative..." : "Run critique"}
              </button>
              <p className="text-sm text-[var(--color-muted)]">
                Backend returns typed JSON only. No freeform AI blob.
              </p>
            </div>
          </form>

          <section className="rounded-[2rem] border border-black/10 bg-[#1f1812] p-5 text-[var(--color-paper)] shadow-[0_30px_90px_rgba(31,24,18,0.16)] md:p-6">
            {loading ? (
              <LoadingState />
            ) : analysis && previewUrl ? (
              <AnalysisPanel analysis={analysis} previewUrl={previewUrl} />
            ) : (
              <EmptyState />
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[var(--color-muted)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition placeholder:text-[#9d8b7d] focus:border-[var(--color-accent)]"
      />
    </label>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5">
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[42rem] flex-col justify-between rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-white/45">
          Analysis surface
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-4xl tracking-[-0.03em] text-white">
          The report appears here once the creative enters the system.
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(226,170,94,0.22),_transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">
            What you will get
          </p>
          <div className="mt-4 grid gap-3">
            <GhostCard
              title="Score breakdown"
              body="Six category scores with an overall conversion read."
            />
            <GhostCard
              title="Annotated preview"
              body="Issue zones rendered directly over the creative."
            />
            <GhostCard
              title="Actionable fixes"
              body="Recommendations written like product feedback, not filler."
            />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-dashed border-white/12 p-5">
          <p className="text-sm font-semibold text-white">MVP discipline</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/62">
            <li>No auth.</li>
            <li>No dashboard sprawl.</li>
            <li>No image generation in V1.</li>
            <li>One strong loop: upload, critique, iterate.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-white/45">
            Running analysis
          </p>
          <h2 className="mt-3 font-display text-4xl tracking-[-0.03em] text-white">
            Parsing hierarchy, contrast, and CTA pull.
          </h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/65">
          This takes a moment
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-pulse space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="h-72 rounded-[1.25rem] bg-white/7" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-24 rounded-[1.25rem] bg-white/7" />
            ))}
          </div>
        </div>
        <div className="animate-pulse space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-20 rounded-[1.25rem] bg-white/7" />
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalysisPanel({
  analysis,
  previewUrl,
}: {
  analysis: AnalysisResponse;
  previewUrl: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-white/45">
            Conversion report
          </p>
          <h2 className="mt-3 font-display text-4xl tracking-[-0.03em] text-white">
            Review complete
          </h2>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">
            Overall score
          </p>
          <p className="mt-2 font-display text-5xl tracking-[-0.04em] text-white">
            {analysis.overallScore}
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <AnnotatedPreview
            previewUrl={previewUrl}
            annotations={analysis.annotations}
            summary={analysis.summary}
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {CATEGORY_LABELS.map((category) => (
              <ScoreCard
                key={category.key}
                label={category.label}
                score={analysis.categoryScores[category.key]}
              />
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">
              Summary
            </p>
            <p className="mt-3 text-base leading-7 text-white/78">{analysis.summary}</p>
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">
              Key issues
            </p>
            <div className="mt-4 space-y-3">
              {analysis.issues.map((issue) => (
                <IssueCard key={issue.id} {...issue} />
              ))}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">
              Recommended fixes
            </p>
            <div className="mt-4 space-y-3">
              {analysis.recommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.id} {...recommendation} />
              ))}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">
              Metric snapshot
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(analysis.metrics).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-[1.25rem] border border-white/10 bg-black/10 p-4"
                >
                  <p className="text-sm text-white/55">
                    {METRIC_LABELS[key] ?? key}
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)]"
                      style={{ width: `${Math.round(value * 100)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {Math.round(value * 100)} / 100
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function AnnotatedPreview({
  previewUrl,
  annotations,
  summary,
}: {
  previewUrl: string;
  annotations: AnalysisResponse["annotations"];
  summary: string;
}) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">
          Annotated preview
        </p>
      </div>

      <div className="relative">
        <img
          src={previewUrl}
          alt="Annotated creative"
          className="aspect-[4/3] w-full object-cover"
        />

        <div className="pointer-events-none absolute inset-0">
          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              className="absolute rounded-[1rem] border-2 border-[var(--color-accent)] bg-[rgba(226,170,94,0.18)] shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
              style={{
                left: `${annotation.x * 100}%`,
                top: `${annotation.y * 100}%`,
                width: `${annotation.w * 100}%`,
                height: `${annotation.h * 100}%`,
              }}
            >
              <div className="absolute left-2 top-2 rounded-full bg-[var(--color-accent)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-ink)]">
                {annotation.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 text-sm leading-6 text-white/62">{summary}</div>
    </section>
  );
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-sm text-white/55">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="font-display text-4xl tracking-[-0.03em] text-white">
          {score}
        </p>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueCard({
  category,
  severity,
  title,
  description,
}: AnalysisResponse["issues"][number]) {
  return (
    <article className="rounded-[1.25rem] border border-white/10 bg-black/10 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-white">{title}</p>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/50">
          {severity}
        </span>
      </div>
      <p className="mt-2 text-sm text-white/55 capitalize">
        {category.replace(/([A-Z])/g, " $1")}
      </p>
      <p className="mt-3 text-sm leading-6 text-white/72">{description}</p>
    </article>
  );
}

function RecommendationCard({
  priority,
  title,
  action,
}: AnalysisResponse["recommendations"][number]) {
  return (
    <article className="rounded-[1.25rem] border border-[rgba(226,170,94,0.2)] bg-[rgba(226,170,94,0.08)] p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-white">{title}</p>
        <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent-ink)]">
          {priority}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/78">{action}</p>
    </article>
  );
}

function GhostCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-black/10 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/58">{body}</p>
    </div>
  );
}
