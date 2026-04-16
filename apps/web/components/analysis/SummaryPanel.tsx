"use client";

export function SummaryPanel({ summary }: { summary: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="text-sm font-semibold text-zinc-900">Summary</div>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{summary}</p>
    </div>
  );
}

