import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdCraft AI — Transform Your Ad Creative with AI-Powered Insights",
  description: "AI-powered critique for ad creatives, landing heroes, and conversion-focused visual systems.",
};

const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --bg2: #0f0f17;
    --surface: #13131d;
    --surface2: #1a1a27;
    --border: rgba(255,255,255,0.07);
    --border2: rgba(255,255,255,0.12);
    --blue: #3b82f6;
    --blue-dim: #2563eb;
    --text: #f1f1f3;
    --text-muted: #6b7280;
    --text-dim: #9ca3af;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
    line-height: 1;
  }

  a { color: inherit; text-decoration: none; }
  ::selection { background: rgba(59,130,246,0.35); }

  nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    height: 60px;
    backdrop-filter: blur(16px);
    background: rgba(10,10,15,0.85);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center;
  }
  .nav-inner {
    max-width: 1160px; margin: 0 auto; padding: 0 32px;
    width: 100%; display: flex; align-items: center; justify-content: space-between;
  }
  .nav-logo { display: flex; align-items: center; gap: 9px; text-decoration: none; }
  .nav-logo-mark {
    width: 30px; height: 30px; border-radius: 8px;
    background: rgba(59,130,246,0.15);
    border: 1px solid rgba(59,130,246,0.3);
    display: flex; align-items: center; justify-content: center;
  }
  .nav-logo-text { font-size: 0.9rem; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
  .nav-logo-text span { color: var(--blue); }
  .nav-links { display: flex; align-items: center; gap: 28px; }
  .nav-link { font-size: 0.82rem; color: var(--text-muted); text-decoration: none; transition: color 0.15s; font-weight: 500; }
  .nav-link:hover { color: var(--text); }

  .btn {
    display: inline-flex; align-items: center; gap: 7px;
    font-family: 'Inter', sans-serif; font-weight: 600;
    cursor: pointer; border: none; text-decoration: none; transition: all 0.15s;
  }
  .btn-blue { background: var(--blue); color: #fff; border-radius: 8px; padding: 9px 18px; font-size: 0.82rem; }
  .btn-blue:hover { background: var(--blue-dim); transform: translateY(-1px); }
  .btn-blue-lg { background: var(--blue); color: #fff; border-radius: 10px; padding: 13px 28px; font-size: 0.9rem; }
  .btn-blue-lg:hover { background: var(--blue-dim); transform: translateY(-1px); }
  .btn-blue-xl { background: var(--blue); color: #fff; border-radius: 10px; padding: 15px 36px; font-size: 0.95rem; }
  .btn-blue-xl:hover { background: var(--blue-dim); transform: translateY(-1px); }

  .hero {
    padding: 120px 32px 90px;
    max-width: 1160px; margin: 0 auto;
    display: grid; grid-template-columns: 1fr 420px;
    gap: 60px; align-items: center;
  }
  .hero-headline {
    font-size: clamp(2.8rem, 5vw, 4.2rem);
    font-weight: 800; letter-spacing: -0.04em; line-height: 1.1;
    color: var(--text); margin-bottom: 20px; text-wrap: balance;
  }
  .hero-sub {
    font-size: 0.95rem; color: var(--text-muted); line-height: 1.7;
    max-width: 480px; margin-bottom: 32px;
  }

  .upload-zone {
    background: var(--surface);
    border: 1.5px dashed rgba(255,255,255,0.15);
    border-radius: 16px; padding: 48px 32px;
    display: flex; flex-direction: column; align-items: center;
    gap: 12px; text-align: center; cursor: pointer;
    transition: border-color 0.2s;
  }
  .upload-zone:hover { border-color: rgba(59,130,246,0.45); }
  .upload-zone.drag-over { border-color: var(--blue); background: rgba(59,130,246,0.04); }
  .upload-icon {
    width: 48px; height: 48px; border-radius: 12px;
    background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2);
    display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
  }
  .upload-hint { font-size: 0.78rem; color: var(--text-muted); line-height: 1.5; }
  .upload-hint span { color: rgba(255,255,255,0.3); }

  .section { padding: 90px 32px; max-width: 1160px; margin: 0 auto; }
  .section-title {
    text-align: center; font-size: 2rem;
    font-weight: 800; letter-spacing: -0.03em; color: var(--text); margin-bottom: 52px;
  }

  .steps { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: flex-start; }
  .step { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 0 16px; }
  .step-circle {
    width: 44px; height: 44px; border-radius: 50%; background: var(--blue);
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 18px; flex-shrink: 0;
  }
  .step-title { font-size: 0.95rem; font-weight: 700; color: var(--text); margin-bottom: 8px; letter-spacing: -0.02em; }
  .step-desc { font-size: 0.82rem; color: var(--text-muted); line-height: 1.6; }
  .step-connector { width: 80px; height: 1px; background: rgba(59,130,246,0.3); margin-top: 22px; flex-shrink: 0; }

  .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .feat-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 24px; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.2s;
  }
  .feat-card:hover { border-color: rgba(59,130,246,0.3); }
  .feat-icon-wrap {
    width: 36px; height: 36px; border-radius: 8px;
    background: rgba(59,130,246,0.1); display: flex; align-items: center; justify-content: center;
  }
  .feat-title { font-size: 0.92rem; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
  .feat-desc { font-size: 0.8rem; color: var(--text-muted); line-height: 1.65; }

  .score-section-wrap {
    background: var(--bg2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
    padding: 90px 32px;
  }
  .score-section {
    max-width: 1160px; margin: 0 auto;
    display: grid; grid-template-columns: 1fr 440px; gap: 80px; align-items: center;
  }
  .score-left-title {
    font-size: clamp(1.8rem, 3.5vw, 2.8rem);
    font-weight: 800; letter-spacing: -0.03em; color: var(--text); margin-bottom: 16px; line-height: 1.15;
  }
  .score-left-desc { font-size: 0.88rem; color: var(--text-muted); line-height: 1.75; }
  .score-card { background: var(--surface); border: 1px solid var(--border2); border-radius: 18px; padding: 28px; }
  .score-ring-wrap { display: flex; flex-direction: column; align-items: center; margin-bottom: 24px; }
  .ring-svg { transform: rotate(-90deg); }
  .ring-track { fill: none; stroke: rgba(255,255,255,0.06); stroke-width: 10; }
  .ring-fill { fill: none; stroke: var(--blue); stroke-width: 10; stroke-linecap: round; }
  .metric-row { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
  .metric-item { display: flex; flex-direction: column; gap: 5px; }
  .metric-label-row { display: flex; justify-content: space-between; }
  .metric-label { font-size: 0.75rem; color: var(--text-dim); font-weight: 500; }
  .metric-val { font-size: 0.75rem; color: var(--text); font-weight: 600; }
  .bar-track { height: 5px; background: rgba(255,255,255,0.07); border-radius: 999px; overflow: hidden; }
  .bar-fill { height: 100%; background: var(--blue); border-radius: 999px; }
  .tag-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag-chip {
    font-size: 0.7rem; font-weight: 600; color: var(--text-dim);
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 6px; padding: 4px 10px;
  }

  .report-section { padding: 90px 32px; max-width: 1160px; margin: 0 auto; }
  .report-card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 32px; }
  .report-top {
    display: grid; grid-template-columns: auto 1fr;
    gap: 32px; align-items: center; padding-bottom: 28px; border-bottom: 1px solid var(--border);
  }
  .score-bar-track { background: rgba(255,255,255,0.07); border-radius: 999px; height: 6px; overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: 999px; }
  .badge { display: inline-flex; align-items: center; border-radius: 5px; padding: 2px 8px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.04em; white-space: nowrap; }
  .badge-high { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
  .badge-med  { background: rgba(251,146,60,0.12); color: #fb923c; border: 1px solid rgba(251,146,60,0.2); }
  .badge-low  { background: rgba(59,130,246,0.1);  color: #60a5fa; border: 1px solid rgba(59,130,246,0.2); }

  .cta-footer { text-align: center; padding: 100px 32px; border-top: 1px solid var(--border); }
  .cta-footer-title {
    font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 800; letter-spacing: -0.04em;
    color: var(--text); margin-bottom: 32px;
  }

  .results-wrap { max-width: 1160px; margin: 0 auto; padding: 40px 32px 80px; }
  .results-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 40px; gap: 20px; }

  @media (max-width: 900px) {
    .hero { grid-template-columns: 1fr; gap: 40px; padding: 100px 24px 60px; }
    .steps { grid-template-columns: 1fr; }
    .step-connector { width: 1px; height: 40px; margin: 0 auto; }
    .features-grid { grid-template-columns: 1fr 1fr; }
    .score-section { grid-template-columns: 1fr; gap: 48px; }
    .report-top { grid-template-columns: 1fr; gap: 16px; }
    .results-header { flex-direction: column; }
  }
  @media (max-width: 600px) {
    .features-grid { grid-template-columns: 1fr; }
    .nav-links .nav-link { display: none; }
  }
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
