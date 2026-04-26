"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { listAnalyses, computeAggregates, deleteAnalysis, type AnalysisRow, type Aggregates } from "@/lib/history";
import { AuthMenu } from "@/components/AuthMenu";

const CATEGORY_LABELS: Record<string, string> = {
  visualHierarchy: "Visual hierarchy",
  ctaProminence: "CTA prominence",
  copyClarity: "Copy clarity",
  readability: "Readability",
  layoutBalance: "Layout balance",
  trustSignals: "Trust signals",
};

function scoreColor(v: number) {
  if (v >= 80) return "#3b82f6";
  if (v >= 60) return "#f59e0b";
  return "#f87171";
}

export default function HistoryPage() {
  const { user, loading: authLoading, authEnabled } = useAuth();
  const [rows, setRows] = useState<AnalysisRow[] | null>(null);
  const [agg, setAgg] = useState<Aggregates | null>(null);

  useEffect(() => {
    if (!user) return;
    listAnalyses().then((rs) => {
      setRows(rs);
      setAgg(computeAggregates(rs));
    });
  }, [user]);

  async function handleDelete(row: AnalysisRow) {
    await deleteAnalysis(row);
    const rs = await listAnalyses();
    setRows(rs);
    setAgg(computeAggregates(rs));
  }

  return (
    <>
      <nav>
        <div className="nav-inner">
          <Link href="./" className="nav-logo">
            <div className="nav-logo-mark">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2l1.8 4.2H14l-3.6 2.6 1.4 4.2L8 10.6l-3.8 2.4 1.4-4.2L2 6.2h4.2L8 2z" fill="#3b82f6"/>
              </svg>
            </div>
            <span className="nav-logo-text">Ad<span>Craft</span></span>
          </Link>
          <div className="nav-links">
            <Link href="./" className="nav-link">Home</Link>
            <AuthMenu />
          </div>
        </div>
      </nav>

      <div className="results-wrap">
        <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", marginBottom: 8 }}>
          Your history
        </h1>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 32 }}>
          Up to 10 most recent analyses. Older ones are pruned automatically.
        </p>

        {!authEnabled ? (
          <EmptyState text="Sign-in isn't configured yet. Add your Supabase URL + anon key to .env.local to enable history." />
        ) : authLoading ? (
          <EmptyState text="Loading…" />
        ) : !user ? (
          <EmptyState text="Sign in (top right) to see your saved analyses." />
        ) : rows === null ? (
          <EmptyState text="Loading your analyses…" />
        ) : rows.length === 0 ? (
          <EmptyState text="No analyses yet. Upload an ad on the home page to start." />
        ) : (
          <>
            {agg ? <AggregatesPanel agg={agg} /> : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16, marginTop: 28 }}>
              {rows.map((r) => (
                <div key={r.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  {r.signedImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.signedImageUrl} alt={r.file_name ?? "ad"} style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", background: "#000" }} />
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "16/10", background: "rgba(255,255,255,0.04)" }} />
                  )}
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleDateString()}</span>
                      <span style={{ fontSize: "1.1rem", fontWeight: 800, color: scoreColor(r.overall) }}>{r.overall}</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.file_name}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{r.source} · {r.ad_type}</div>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      style={{ marginTop: "auto", background: "transparent", border: "1px solid var(--border2)", color: "var(--text-dim)", borderRadius: 8, padding: "6px 10px", fontSize: "0.72rem", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 32, textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)" }}>
      {text}
    </div>
  );
}

function AggregatesPanel({ agg }: { agg: Aggregates }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
      <Stat label="Analyses" value={String(agg.count)} />
      <Stat label="Average overall" value={String(agg.averageOverall)} accent={scoreColor(agg.averageOverall)} />
      <Stat label="Best overall" value={agg.best ? String(agg.best.overall) : "—"} accent="#3b82f6" />
      <Stat label="Worst overall" value={agg.worst ? String(agg.worst.overall) : "—"} accent="#f87171" />
      {(Object.keys(agg.averagesByCategory) as (keyof typeof agg.averagesByCategory)[]).map((k) => (
        <Stat key={k} label={`Avg ${CATEGORY_LABELS[k] ?? k}`} value={String(agg.averagesByCategory[k])} accent={scoreColor(agg.averagesByCategory[k])} />
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: accent ?? "var(--text)" }}>{value}</div>
    </div>
  );
}
