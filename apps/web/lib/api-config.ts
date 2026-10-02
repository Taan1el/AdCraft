const DEFAULT_API_BASE = "http://127.0.0.1:8010";

export function normalizeApiBase(value: string | undefined): string | null {
  if (value === undefined) return DEFAULT_API_BASE;
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return normalized;
}
