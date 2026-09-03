const DEFAULT_API_BASE = "http://127.0.0.1:8010";

export function normalizeApiBase(value: string | undefined): string | null {
  if (value === undefined) return DEFAULT_API_BASE;
  return value.trim().replace(/\/+$/, "") || null;
}
