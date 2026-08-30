import Link from "next/link";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ layout */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface-1)] ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  hint,
  action,
}: {
  children: ReactNode;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
          {children}
        </h2>
        {hint && (
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            {hint}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- stats */

/**
 * Hero number. A single value with no plot -- per the form heuristic, one
 * number does not want a chart.
 */
export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "good" | "warning" | "critical";
}) {
  const toneColor =
    tone === "good"
      ? "var(--good)"
      : tone === "warning"
        ? "var(--serious)"
        : tone === "critical"
          ? "var(--critical)"
          : "var(--text-primary)";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
      <p className="text-[11.5px] font-medium uppercase tracking-[0.055em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className="tnum mt-2 text-[27px] font-semibold leading-none tracking-[-0.02em]"
        style={{ color: toneColor }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-2 text-[12.5px] leading-snug text-[var(--text-secondary)]">
          {sub}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ badges */

type BadgeTone =
  | "neutral"
  | "good"
  | "warning"
  | "serious"
  | "critical"
  | "accent";

const BADGE_STYLES: Record<BadgeTone, { bg: string; fg: string; bd: string }> = {
  neutral: {
    bg: "var(--surface-2)",
    fg: "var(--text-secondary)",
    bd: "var(--border)",
  },
  good: { bg: "var(--good-soft)", fg: "var(--good)", bd: "transparent" },
  warning: { bg: "var(--warning-soft)", fg: "var(--serious)", bd: "transparent" },
  serious: { bg: "var(--warning-soft)", fg: "var(--serious)", bd: "transparent" },
  critical: {
    bg: "var(--critical-soft)",
    fg: "var(--critical)",
    bd: "transparent",
  },
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)", bd: "transparent" },
};

export function Badge({
  children,
  tone = "neutral",
  icon,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
}) {
  const s = BADGE_STYLES[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-[3px] text-[11.5px] font-medium leading-tight"
      style={{ background: s.bg, color: s.fg, borderColor: s.bd }}
    >
      {icon}
      {children}
    </span>
  );
}

/** Status icons so a state is never carried by color alone. */
export function StatusIcon({ status }: { status: string }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (status === "resolved")
    return (
      <svg {...common}>
        <path d="m5 13 4 4L19 7" />
      </svg>
    );
  if (status === "improving")
    return (
      <svg {...common}>
        <path d="m4 17 6-6 4 4 6-7" />
        <path d="M15 8h5v5" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M12 8v5" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
    </svg>
  );
}

export function PatternStatusBadge({ status }: { status: string }) {
  const tone: BadgeTone =
    status === "resolved" ? "good" : status === "improving" ? "warning" : "critical";
  const label =
    status === "resolved"
      ? "Resolving"
      : status === "improving"
        ? "Improving"
        : "Active";
  return (
    <Badge tone={tone} icon={<StatusIcon status={status} />}>
      {label}
    </Badge>
  );
}

export function confidenceLabel(confidence: number): "High" | "Medium" | "Low" {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.55) return "Medium";
  return "Low";
}

/** How strongly the evidence supports a pattern, shown wherever a pattern is. */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const label = confidenceLabel(confidence);
  return (
    <Badge tone="neutral">
      <span
        className="inline-flex items-end gap-[1.5px]"
        aria-hidden
        style={{ height: 9 }}
      >
        {[3, 6, 9].map((h, i) => (
          <span
            key={h}
            style={{
              width: 2.5,
              height: h,
              borderRadius: 1,
              background:
                (label === "High" && i <= 2) ||
                (label === "Medium" && i <= 1) ||
                (label === "Low" && i === 0)
                  ? "var(--text-secondary)"
                  : "var(--border-strong)",
            }}
          />
        ))}
      </span>
      {label} confidence
    </Badge>
  );
}

/* ------------------------------------------------------------- accuracy bar */

export function accuracyTone(
  accuracy: number,
): "good" | "warning" | "critical" {
  if (accuracy >= 0.75) return "good";
  if (accuracy >= 0.6) return "warning";
  return "critical";
}

export function accuracyColor(accuracy: number): string {
  const tone = accuracyTone(accuracy);
  return tone === "good"
    ? "var(--good)"
    : tone === "warning"
      ? "var(--serious)"
      : "var(--critical)";
}

/**
 * A one-row magnitude bar. The percentage is always printed next to it, so the
 * color is reinforcement rather than the only channel.
 */
export function AccuracyBar({
  accuracy,
  total,
  correct,
  compact = false,
}: {
  accuracy: number;
  total?: number;
  correct?: number;
  compact?: boolean;
}) {
  const pct = Math.round(accuracy * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative ${compact ? "h-1.5" : "h-2"} min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]`}
        role="img"
        aria-label={`${pct}% accuracy${total ? ` on ${total} questions` : ""}`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${Math.max(pct, 1.5)}%`,
            background: accuracyColor(accuracy),
          }}
        />
      </div>
      <span
        className="tnum w-[38px] shrink-0 text-right text-[13px] font-semibold"
        style={{ color: accuracyColor(accuracy) }}
      >
        {pct}%
      </span>
      {total !== undefined && (
        <span className="tnum w-[52px] shrink-0 text-right text-[12px] text-[var(--text-muted)]">
          {correct}/{total}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ buttons */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55";

export const buttonStyles = {
  primary: `${BUTTON_BASE} bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]`,
  secondary: `${BUTTON_BASE} border border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--text-primary)] hover:bg-[var(--surface-2)]`,
  ghost: `${BUTTON_BASE} text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]`,
};

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof buttonStyles;
}) {
  return (
    <Link href={href} className={buttonStyles[variant]}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------- empty state */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-1)] px-6 py-14 text-center">
      {icon && <div className="mb-4 text-[var(--text-muted)]">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- misc bits */

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11.5px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-[13.5px] text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

export function AnswerChip({
  label,
  variant,
}: {
  label: string;
  variant: "chosen" | "correct";
}) {
  const correct = variant === "correct";
  return (
    <span
      className="tnum inline-flex size-[22px] items-center justify-center rounded-md text-[12px] font-semibold"
      style={{
        background: correct ? "var(--good-soft)" : "var(--critical-soft)",
        color: correct ? "var(--good)" : "var(--critical)",
      }}
      title={correct ? "Correct answer" : "Your answer"}
    >
      {label}
    </span>
  );
}

export function Divider() {
  return <hr className="my-5 border-t border-[var(--border)]" />;
}
