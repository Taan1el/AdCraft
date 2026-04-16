"use client";

import type { Annotation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

type Box = { left: number; top: number; width: number; height: number; label: string; id: string };

export function AnnotatedPreview({
  file,
  annotations,
}: {
  file: File;
  annotations: Annotation[];
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [imgRect, setImgRect] = useState<{ w: number; h: number; left: number; top: number } | null>(
    null
  );

  const url = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    function compute() {
      const img = imgRef.current;
      const wrap = wrapRef.current;
      if (!img || !wrap) return;
      const ir = img.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      setImgRect({ w: ir.width, h: ir.height, left: ir.left - wr.left, top: ir.top - wr.top });
    }
    compute();
    const ro = new ResizeObserver(compute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, []);

  const boxes: Box[] = useMemo(() => {
    if (!imgRect) return [];
    return annotations
      .filter((a) => a.type === "box")
      .map((a) => ({
        id: a.id,
        label: a.label,
        left: imgRect.left + a.x * imgRect.w,
        top: imgRect.top + a.y * imgRect.h,
        width: a.w * imgRect.w,
        height: a.h * imgRect.h,
      }));
  }, [annotations, imgRect]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="text-sm font-semibold text-zinc-900">Annotated preview</div>
      <div
        ref={wrapRef}
        className="relative mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={url}
          alt="Creative with annotations"
          className="h-[420px] w-full object-contain"
          onLoad={() => {
            setTimeout(() => {
              const img = imgRef.current;
              const wrap = wrapRef.current;
              if (!img || !wrap) return;
              const ir = img.getBoundingClientRect();
              const wr = wrap.getBoundingClientRect();
              setImgRect({ w: ir.width, h: ir.height, left: ir.left - wr.left, top: ir.top - wr.top });
            }, 0);
          }}
        />

        {boxes.map((b, idx) => (
          <div
            key={b.id}
            className={cn(
              "absolute rounded-lg border-2 bg-rose-500/10",
              idx % 2 === 0 ? "border-rose-500" : "border-amber-500 bg-amber-500/10"
            )}
            style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
          >
            <div
              className={cn(
                "absolute -top-3 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow",
                idx % 2 === 0 ? "bg-rose-600" : "bg-amber-600"
              )}
            >
              {b.label}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-zinc-500">
        Boxes are conservative (heuristic) in MVP mock mode.
      </div>
    </div>
  );
}

