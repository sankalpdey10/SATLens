"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimePoint } from "@/lib/stats";
import { MISTAKE_LABELS, type MistakeType } from "@/lib/taxonomy";

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function TooltipCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-primary)]">
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-[12px]">
            {r.color && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: r.color }}
              />
            )}
            <span className="text-[var(--text-secondary)]">{r.label}</span>
            <span className="tnum ml-auto font-medium text-[var(--text-primary)]">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Improvement over time. Two series on ONE axis (both are percentages):
 * day-by-day accuracy, and the cumulative average that smooths the noise.
 */
export function AccuracyTrendChart({ data }: { data: TimePoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg bg-[var(--surface-2)] text-[13px] text-[var(--text-muted)]">
        Practice on at least two different days to see a trend.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: d.date,
    day: Math.round(d.accuracy * 100),
    cumulative: Math.round(d.cumulativeAccuracy * 100),
    total: d.total,
    correct: d.correct,
  }));

  return (
    <div>
      {/* Legend is always present for 2+ series -- identity is never color-alone. */}
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <LegendKey color="var(--series-1)" label="Cumulative accuracy" />
        <LegendKey color="var(--series-2)" label="That day" dashed />
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 14, left: -18, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof chartData)[number];
              return (
                <TooltipCard
                  title={String(label)}
                  rows={[
                    {
                      label: "Cumulative",
                      value: `${p.cumulative}%`,
                      color: "var(--series-1)",
                    },
                    {
                      label: "That day",
                      value: `${p.day}% (${p.correct}/${p.total})`,
                      color: "var(--series-2)",
                    },
                  ]}
                />
              );
            }}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="day"
            stroke="var(--series-2)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 3, strokeWidth: 0, fill: "var(--series-2)" }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface-1)" }}
          />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="cumulative"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: "var(--series-1)" }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface-1)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendKey({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
      <svg width="18" height="8" aria-hidden>
        <line
          x1="0"
          y1="4"
          x2="18"
          y2="4"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? "4 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}

/**
 * Mistake mix. One measure across categories -> plain magnitude bars in a
 * single hue, sorted descending. No pie chart: shares this similar are
 * unreadable as angles.
 */
export function MistakeMixChart({
  data,
}: {
  data: { mistake_type: string; count: number; share: number }[];
}) {
  if (!data.length) {
    return (
      <p className="rounded-lg bg-[var(--surface-2)] px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">
        No diagnosed mistakes yet.
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.count));

  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => {
        const label =
          MISTAKE_LABELS[d.mistake_type as MistakeType] ?? d.mistake_type;
        return (
          <li key={d.mistake_type} className="grid grid-cols-[1fr_auto] gap-x-3">
            <span className="truncate text-[13px] text-[var(--text-primary)]">
              {label}
            </span>
            <span className="tnum text-[12.5px] text-[var(--text-secondary)]">
              {d.count}
              <span className="ml-1.5 text-[var(--text-muted)]">
                {Math.round(d.share * 100)}%
              </span>
            </span>
            <div className="col-span-2 mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(d.count / max) * 100}%`,
                  background: "var(--seq-400)",
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Retest timeline for one pattern: a row of correct/incorrect marks in
 * chronological order, which is what "is this resolving?" actually looks like.
 */
export function RetestTimeline({
  attempts,
}: {
  attempts: { id: string; occurred_on: string; isCorrect: boolean }[];
}) {
  if (!attempts.length) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        No attempts on this skill since the pattern was detected. Practice it to
        start building evidence.
      </p>
    );
  }

  return (
    <ol className="flex flex-wrap items-end gap-2">
      {attempts.map((a) => (
        <li key={a.id} className="flex flex-col items-center gap-1.5">
          <span
            className="grid size-7 place-items-center rounded-md"
            style={{
              background: a.isCorrect ? "var(--good-soft)" : "var(--critical-soft)",
              color: a.isCorrect ? "var(--good)" : "var(--critical)",
            }}
            title={`${a.occurred_on}: ${a.isCorrect ? "correct" : "incorrect"}`}
          >
            {a.isCorrect ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 13 4 4L19 7" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            )}
            <span className="sr-only">
              {a.occurred_on}: {a.isCorrect ? "correct" : "incorrect"}
            </span>
          </span>
          <span className="text-[10.5px] text-[var(--text-muted)]">
            {formatDate(a.occurred_on)}
          </span>
        </li>
      ))}
    </ol>
  );
}
