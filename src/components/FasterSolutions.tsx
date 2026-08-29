"use client";

import { useState } from "react";
import { buttonStyles } from "./ui";

interface Insight {
  title: string;
  description: string;
  applies_to_skill: string;
  example_attempt_ids: string[];
}

/**
 * On-demand rather than precomputed: this call is only worth making once the
 * student actually wants it, and it re-reads their latest mistakes each time.
 */
export function FasterSolutions({
  skill,
  enabled,
}: {
  skill?: string;
  enabled: boolean;
}) {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Request failed");
      setInsights(data.insights ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (!enabled) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        SATLens needs at least 3 diagnosed misses on this skill before it can spot
        a reliable efficiency pattern.
      </p>
    );
  }

  if (insights === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button onClick={run} disabled={pending} className={buttonStyles.secondary}>
          {pending && <span className="pulse size-1.5 rounded-full bg-current" aria-hidden />}
          {pending ? "Looking at your solutions..." : "Find faster approaches"}
        </button>
        {error && (
          <p className="text-[12.5px] text-[var(--critical)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!insights.length) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        No clear efficiency pattern in your misses here -- your approaches look
        reasonable. The issue is accuracy, not speed.
      </p>
    );
  }

  return (
    <ul className="fade-up flex flex-col gap-3">
      {insights.map((insight) => (
        <li
          key={insight.title}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4"
        >
          <h3 className="mb-1.5 text-[13.5px] font-semibold text-[var(--text-primary)]">
            {insight.title}
          </h3>
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {insight.description}
          </p>
          {insight.example_attempt_ids.length > 0 && (
            <p className="mt-2 text-[12px] text-[var(--text-muted)]">
              Based on {insight.example_attempt_ids.length} of your questions
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
