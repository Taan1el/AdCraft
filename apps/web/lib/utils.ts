export function cn(...classes: Array<string | undefined | false | null>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatPct01(x: number): string {
  const v = Math.max(0, Math.min(1, x));
  return `${Math.round(v * 100)}%`;
}

