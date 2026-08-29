"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: "grid", exact: true },
  { href: "/import", label: "Import", icon: "upload" },
  { href: "/patterns", label: "Patterns", icon: "lens" },
  { href: "/errors", label: "Error Log", icon: "list" },
  { href: "/practice", label: "Practice", icon: "target" },
  { href: "/plan", label: "Study Plan", icon: "calendar" },
];

function Icon({ name }: { name: string }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
      );
    case "lens":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
          <path d="M8.5 11.5 11 14l4-4.5" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <circle cx="3.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="18" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    default:
      return null;
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("satlens-theme");
    if (stored === "dark" || stored === "light") setTheme(stored);
    else
      setTheme(
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
      );
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("satlens-theme", next);
  }

  return (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
      aria-label="Toggle color theme"
    >
      <span className="grid size-[17px] place-items-center">
        {theme === "dark" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
        )}
      </span>
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}

export function Sidebar({ demo = false }: { demo?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-[216px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-1)] px-3 py-5">
      <Link href="/" className="mb-7 flex items-center gap-2.5 px-3">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{ background: "var(--accent)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m20 20-4.5-4.5" />
          </svg>
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">
          SATLens
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-[var(--border)] pt-3">
        {/* Demo mode must never be mistaken for real analysis. */}
        {demo && (
          <div
            className="mx-1 mb-1 rounded-lg px-2.5 py-2"
            style={{ background: "var(--warning-soft)" }}
            role="status"
          >
            <p
              className="flex items-center gap-1.5 text-[11.5px] font-semibold"
              style={{ color: "var(--serious)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M12 8v5" />
                <circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
                <circle cx="12" cy="12" r="9" strokeWidth="2" />
              </svg>
              Demo mode
            </p>
            <p className="mt-1 text-[11px] leading-snug text-[var(--text-secondary)]">
              Analysis is rule-based, not AI. Add an API key and restart for real
              diagnosis.
            </p>
          </div>
        )}
        <ThemeToggle />
        <p className="px-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
          Practice questions are AI-generated originals. No College Board content
          is stored or redistributed.
        </p>
      </div>
    </aside>
  );
}
