"use client";

import { useData } from "../lib/store";

/* ---- helpers ---- */
export function fmtTs(ts: string): string {
  if (!ts) return "—";
  return ts.replace("T", " ").slice(0, 19);
}

export function toneFor(status: string): string {
  const s = (status || "").toLowerCase();
  if (["qualified", "approved", "launched", "live", "ok"].includes(s)) return "green";
  if (["pending_approval", "created_paused", "pending"].includes(s)) return "amber";
  if (["not_qualified", "rejected", "failed"].includes(s)) return "red";
  return "plain";
}

export function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone || "plain"}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${toneFor(status)}`}>{(status || "").replace(/_/g, " ")}</span>;
}

/* ---- page header ---- */
export function PageHead({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-head reveal">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="page-title">{title}</h1>
      {lede && <p className="page-lede">{lede}</p>}
      {children}
    </header>
  );
}

export function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="section-label">
      <span className="n">{n}</span>
      {children}
    </div>
  );
}

/* ---- error banner (global) ---- */
export function ErrorBanner() {
  const { error } = useData();
  if (!error) return null;
  return <div className="banner-err reveal">⚠ {error}</div>;
}

/* ---- decorative azulejo motif for the hero ---- */
export function AzulejoTiles() {
  return (
    <svg className="hero-tiles" viewBox="0 0 200 200" aria-hidden>
      <defs>
        <pattern id="azu" width="50" height="50" patternUnits="userSpaceOnUse">
          <rect width="50" height="50" fill="none" />
          <path d="M25 4 L46 25 L25 46 L4 25 Z" fill="none" stroke="#2c5f86" strokeWidth="1.4" />
          <circle cx="25" cy="25" r="6" fill="none" stroke="#bf5430" strokeWidth="1.4" />
          <path d="M0 0 L8 8 M50 0 L42 8 M0 50 L8 42 M50 50 L42 42" stroke="#2c5f86" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect width="200" height="200" fill="url(#azu)" />
    </svg>
  );
}

/* ---- stat card ---- */
export function Stat({
  k,
  v,
  sub,
  tone,
}: {
  k: string;
  v: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "azulejo" | "sage" | "";
}) {
  return (
    <div className={`stat ${tone || ""}`}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
