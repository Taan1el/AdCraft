"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

// Minimal nav-corner login UI. When auth isn't configured, renders nothing —
// keeps the anonymous flow clean for visitors before Supabase is wired up.
export function AuthMenu() {
  const { user, authEnabled, signInWithEmail, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!authEnabled) return null;

  if (user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <a href="./history" className="nav-link">History</a>
        <a href="./dashboard" className="nav-link">Dashboard</a>
        <button
          type="button"
          className="btn"
          onClick={() => signOut()}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "7px 12px", fontSize: "0.78rem", color: "var(--text-dim)" }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="btn btn-blue" onClick={() => setOpen((v) => !v)}>
        Sign in
      </button>
      {open ? (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 280, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: 14, zIndex: 200 }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Sign in to save your ads</div>
          <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.5 }}>We&apos;ll email you a one-tap login link — no password needed.</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border2)", borderRadius: 8, padding: "8px 10px", fontSize: "0.82rem", color: "var(--text)", marginBottom: 8 }}
          />
          <button
            type="button"
            className="btn btn-blue"
            disabled={busy || !email.includes("@")}
            style={{ width: "100%", justifyContent: "center", opacity: busy || !email.includes("@") ? 0.5 : 1 }}
            onClick={async () => {
              setBusy(true);
              const r = await signInWithEmail(email.trim());
              setMsg({ ok: r.ok, text: r.message });
              setBusy(false);
            }}
          >
            {busy ? "Sending…" : "Send magic link"}
          </button>
          {msg ? (
            <p style={{ fontSize: "0.74rem", color: msg.ok ? "#60a5fa" : "#f87171", marginTop: 8 }}>{msg.text}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
