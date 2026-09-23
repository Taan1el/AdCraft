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

// Derive a lowercased file extension for use as a storage object-key suffix.
// A `split(".").pop()` on an extensionless name like "logo" returns the whole
// name ("logo"), which would then masquerade as the extension in the object
// key; a trailing dot ("logo.") returns "", and a junk suffix ("a.n@me") is not
// a real extension. Require a dot followed by 1-5 alphanumerics, else fall back
// to `fallback` so the key always ends in a plausible extension.
export function imageExtension(fileName: string, fallback = "png"): string {
  if (typeof fileName !== "string") return fallback;
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : fallback;
}

