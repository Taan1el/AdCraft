"use client";

import type { Recommendation } from "@/lib/types";

export function RecommendationsList({ items }: { items: Recommendation[] }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-900">Recommended fixes</div>
        <div className="text-xs text-zinc-500">{items.length}</div>
      </div>
      {items.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-sm text-zinc-600">
          No recommendations returned in mock mode.
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((r) => (
            <li key={r.id} className="rounded-xl border border-zinc-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{r.title}</div>
                  <div className="text-xs text-zinc-500">{r.category}</div>
                </div>
                <div className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                  {r.priority}
                </div>
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-700">{r.action}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

