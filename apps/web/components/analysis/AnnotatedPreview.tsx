"use client";

import type { Annotation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Box = { left: number; top: number; width: number; height: number; label: string; id: string };

type ImgRect = { w: number; h: number; left: number; top: number };

// The image renders with object-contain, so it is letterboxed inside its
// element: the visible picture is scaled to fit and centered, leaving bars on
// the long axis. Annotation coordinates are normalized to the *image*, so
// overlay boxes must be placed against that contained picture — not the element
// box. Using the element box (as this did before) floated every box into the
// letterbox gap whenever the image's aspect ratio differed from the element's.
// Returns the contained picture's rect relative to `wrap`, or null before the
// image has reported its natural size.
function containedImageRect(img: HTMLImageElement, wrap: HTMLElement): ImgRect | null {
  const { naturalWidth, naturalHeight } = img;
  if (!naturalWidth || !naturalHeight) return null;
  const ir = img.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const scale = Math.min(ir.width / naturalWidth, ir.height / naturalHeight);
  const contentW = naturalWidth * scale;
  const contentH = naturalHeight * scale;
  return {
    w: contentW,
    h: contentH,
    left: ir.left - wr.left + (ir.width - contentW) / 2,
    top: ir.top - wr.top + (ir.height - contentH) / 2,
  };
}

export function AnnotatedPreview({
  file,
  annotations,
}: {
  file: File;
  annotations: Annotation[];
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [imgRect, setImgRect] = useState<ImgRect | null>(null);

  const url = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const measure = useCallback(() => {
    const img = imgRef.current;
    const wrap = wrapRef.current;
    if (!img || !wrap) return;
    const rect = containedImageRect(img, wrap);
    if (rect) setImgRect(rect);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

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
            // Defer a tick so layout has settled before reading the rendered box.
            setTimeout(measure, 0);
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

