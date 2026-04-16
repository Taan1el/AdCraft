"use client";

import type { AdType } from "@/lib/types";

const OPTIONS: Array<{ value: AdType; label: string; hint: string }> = [
  { value: "display_ad", label: "Display ad", hint: "Banners, static display placements" },
  { value: "landing_hero", label: "Landing hero", hint: "Above-the-fold hero sections" },
  { value: "email_hero", label: "Email hero", hint: "Top of an email / promo banner" },
  { value: "social_ad", label: "Social ad", hint: "IG/TikTok/X/Facebook image ads" },
];

export function AdTypeSelect({
  value,
  onChange,
}: {
  value: AdType;
  onChange: (v: AdType) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-900">Ad type</label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                "rounded-xl border px-3 py-2 text-left transition",
                active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
              ].join(" ")}
            >
              <div className="text-sm font-semibold leading-5">{opt.label}</div>
              <div className={active ? "text-xs text-zinc-200" : "text-xs text-zinc-500"}>
                {opt.hint}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

