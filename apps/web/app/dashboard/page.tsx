"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth-context";
import { listAnalyses, type AnalysisRow } from "@/lib/history";
import { AuthMenu } from "@/components/AuthMenu";

const SESSION_QUERY_CAP = 10;
const QUERY_KEY = "adcraft.dashboard.queries";
const QUERY_COUNT_EVENT = "adcraft:query-count";
let fallbackQueryCount = 0;

function getQueryCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const count = Number(window.sessionStorage.getItem(QUERY_KEY) ?? 0);
    fallbackQueryCount = Number.isFinite(count) && count > 0 ? count : 0;
    return fallbackQueryCount;
  } catch {
    return fallbackQueryCount;
  }
}
function bumpQueryCount(): void {
  if (typeof window === "undefined") return;
  const n = getQueryCount() + 1;
  fallbackQueryCount = n;
  try {
    window.sessionStorage.setItem(QUERY_KEY, String(n));
  } catch {
    // Dashboard still works when session storage is unavailable.
  }
  window.dispatchEvent(new Event(QUERY_COUNT_EVENT));
}
function subscribeToQueryCount(onStoreChange: () => void): () => void {
  window.addEventListener(QUERY_COUNT_EVENT, onStoreChange);
  return () => window.removeEventListener(QUERY_COUNT_EVENT, onStoreChange);
}

export default function DashboardPage() {
  const { user, authEnabled, loading } = useAuth();
  const [history, setHistory] = useState<{ userId: string; rows: AnalysisRow[] } | null>(null);
  const rows = history && history.userId === user?.id ? history.rows : [];
  const queries = useSyncExternalStore(subscribeToQueryCount, getQueryCount, () => 0);

  const embed = process.env.NEXT_PUBLIC_THESYS_EMBED_URL || "";

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let current = true;
    void listAnalyses().then((nextRows) => {
      if (current) setHistory({ userId, rows: nextRows });
    });
    return () => { current = false; };
  }, [user?.id]);

  const remaining = Math.max(0, SESSION_QUERY_CAP - queries);

  return (
    <>
      <nav>
        <div className="nav-inner">
          <Link href="./" className="nav-logo" aria-label="AdCraft home">
            <span className="nav-logo-text" style={{ fontSize: "1.05rem" }}>Ad<span>Craft</span></span>
          </Link>
          <div className="nav-links">
            <Link href="./" className="nav-link">Home</Link>
            <Link href="./history" className="nav-link">History</Link>
            <AuthMenu />
          </div>
        </div>
      </nav>

      <div className="results-wrap">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", marginBottom: 8 }}>
              Dashboard
            </h1>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: 640, lineHeight: 1.6 }}>
              Ask the Thesys agent natural-language questions about your saved ads — &quot;show my CTA scores by month&quot;, &quot;which ad type scores worst on readability&quot;, etc.
            </p>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: "0.78rem", color: "var(--text-dim)" }}>
            Session queries: <strong style={{ color: "var(--text)" }}>{queries}</strong> / {SESSION_QUERY_CAP} · {remaining} left
          </div>
        </div>

        {!authEnabled || loading ? (
          <Empty text="Auth not configured or still loading." />
        ) : !user ? (
          <Empty text="Sign in (top right) to use the dashboard." />
        ) : !embed ? (
          <SetupGuide rowCount={rows.length} />
        ) : remaining === 0 ? (
          <Empty text="Session query cap reached. Refresh the page to reset." />
        ) : (
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", height: "70vh", minHeight: 520 }}>
            <iframe
              src={embed}
              title="Thesys agent"
              style={{ border: 0, width: "100%", height: "100%", background: "#0a0a0f" }}
              onLoad={bumpQueryCount}
            />
          </div>
        )}
      </div>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 32, textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)" }}>
      {text}
    </div>
  );
}

function SetupGuide({ rowCount }: { rowCount: number }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 28 }}>
      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
        One-time Thesys setup
      </div>
      <ol style={{ paddingLeft: 18, fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.8 }}>
        <li>Go to <a href="https://www.thesys.dev/agent-builder" target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>thesys.dev/agent-builder</a> and create an agent.</li>
        <li>Connect it to your Supabase <code>analyses</code> table (Postgres connector, use the <em>read-only</em> service role or a custom restricted role).</li>
        <li>Describe the agent: &quot;You answer questions about ad-creative analyses. Each row has a 0-100 overall score and category scores.&quot;</li>
        <li>Publish, copy the embed/iframe URL.</li>
        <li>Paste it into <code>apps/web/.env.local</code> as <code>NEXT_PUBLIC_THESYS_EMBED_URL</code>, restart <code>npm run dev</code>.</li>
      </ol>
      <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginTop: 14 }}>
        You currently have <strong style={{ color: "var(--text)" }}>{rowCount}</strong> analyses ready to query.
      </div>
    </div>
  );
}
