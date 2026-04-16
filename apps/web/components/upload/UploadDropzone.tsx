"use client";

import { cn } from "@/lib/utils";
import { useMemo, useRef, useState } from "react";

export function UploadDropzone({
  value,
  onChange,
  disabled,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const previewUrl = useMemo(() => {
    if (!value) return null;
    return URL.createObjectURL(value);
  }, [value]);

  function pick() {
    inputRef.current?.click();
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && pick()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") pick();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (disabled) return;
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          const f = e.dataTransfer.files?.[0];
          if (f) onChange(f);
        }}
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-white p-4 transition",
          disabled && "opacity-60 pointer-events-none",
          dragOver ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-300"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900">
              {value ? value.name : "Upload a creative"}
            </div>
            <div className="text-xs text-zinc-500">
              Drag & drop a PNG/JPG/WEBP, or click to browse
            </div>
          </div>
          <div className="flex items-center gap-2">
            {value ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
              >
                Remove
              </button>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pick();
              }}
              className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              Browse
            </button>
          </div>
        </div>

        {previewUrl ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Uploaded creative preview"
              className="h-56 w-full object-contain"
            />
          </div>
        ) : (
          <div className="mt-4 grid place-items-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 py-10">
            <div className="text-sm text-zinc-600">Drop an image here</div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
    </div>
  );
}

