"use client";

export function ScoreCard({
  label,
  score,
  hint,
}: {
  label: string;
  score: number;
  hint?: string;
}) {
  const s = Math.max(0, Math.min(100, score));
  const tone =
    s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{label}</div>
          {hint ? <div className="text-xs text-zinc-500">{hint}</div> : null}
        </div>
        <div className="text-2xl font-semibold tabular-nums text-zinc-900">{s}</div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full ${tone}`} style={{ width: `${s}%` }} />
      </div>
    </div>
  );
}

