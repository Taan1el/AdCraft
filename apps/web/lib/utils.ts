export function cn(...classes: Array<string | undefined | false | null>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatPct01(x: number): string {
  // A non-finite input (NaN/Infinity from a missing or malformed metric) slips
  // straight through Math.min/max and renders as the literal "NaN%". Coerce it
  // to 0% so a bad score can never surface as junk text in the UI.
  const v = Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
  return `${Math.round(v * 100)}%`;
}

