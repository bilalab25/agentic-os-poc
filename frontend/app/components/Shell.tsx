"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DataProvider, useData } from "../lib/store";

const NAV = [
  { href: "/", label: "Overview", num: "00" },
  { href: "/leads", label: "Leads", num: "01" },
  { href: "/studio", label: "Creative Studio", num: "02" },
  { href: "/campaigns", label: "Campaigns", num: "03" },
  { href: "/governance", label: "Governance", num: "04" },
];

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#bf5430" />
      <g fill="none" stroke="#f7f1e7" strokeWidth="3.4" strokeLinecap="round">
        <path d="M18 44V20l28 24V20" />
      </g>
      <circle cx="46" cy="20" r="3.2" fill="#f7f1e7" />
    </svg>
  );
}

function SideStatus() {
  const { health, verify, ready } = useData();
  return (
    <div className="side-foot">
      <div className="side-stat">
        <span>Audit chain</span>
        <span className="mono" style={{ color: verify?.valid === false ? "var(--claret)" : "var(--sage)" }}>
          {verify ? (verify.valid ? "✓ intact" : "⚠ broken") : "…"}
        </span>
      </div>
      <div className="side-stat">
        <span>LLM</span>
        <span className="mono">{health?.llm_provider ?? "…"}</span>
      </div>
      <div className="side-stat">
        <span>Meta Ads</span>
        <span className="mono">{health?.meta_mode ?? "…"}</span>
      </div>
      <div className="side-stat">
        <span>Store</span>
        <span className="mono">{health?.database ?? (ready ? "—" : "…")}</span>
      </div>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">
        <BrandMark />
        <div>
          <div className="brand-name">Agentic OS</div>
          <div className="brand-sub">Norma · Lisboa</div>
        </div>
      </div>
      <nav className="nav">
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link key={n.href} href={n.href} className={`nav-item${active ? " active" : ""}`}>
              <span className="num">{n.num}</span>
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <SideStatus />
    </aside>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <div className="app">
        <Sidebar />
        <main className="main">{children}</main>
      </div>
    </DataProvider>
  );
}
