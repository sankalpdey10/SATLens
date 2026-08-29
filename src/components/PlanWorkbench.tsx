"use client";

import { useState } from "react";
import { Card, CardTitle, StatTile, buttonStyles } from "./ui";

interface Profile {
  test_date: string | null;
  target_score: number | null;
  current_score: number | null;
  hours_per_week: number | null;
}

interface Plan {
  summary: string;
  adjustment_note: string | null;
  allocations: {
    skill: string;
    domain: string;
    share_of_time: number;
    rationale: string;
  }[];
  sessions: {
    label: string;
    focus: string;
    minutes: number;
    activity: string;
    success_check: string;
  }[];
  milestones: { when: string; target: string }[];
}

const inputClass =
  "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 py-2 text-[13.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]";

const labelClass =
  "mb-1.5 block text-[11.5px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]";

export function PlanWorkbench({
  profile: initialProfile,
  hasData,
  diagnosed,
}: {
  profile: Profile;
  hasData: boolean;
  diagnosed: number;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const daysLeft = profile.test_date
    ? Math.ceil(
        (new Date(profile.test_date).getTime() - Date.now()) / 86_400_000,
      )
    : null;

  async function saveProfile() {
    setPending("Saving...");
    setError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Save failed");
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setPending(null);
    }
  }

  async function generate() {
    setPending("Weighing your weaknesses against your available time...");
    setError(null);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const response = await fetch("/api/plan", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not build a plan");
      setPlan(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle hint="Everything here shapes how time gets allocated.">
          Your situation
        </CardTitle>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={labelClass}>Test date</span>
            <input
              type="date"
              value={profile.test_date ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, test_date: e.target.value || null })
              }
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Target score</span>
            <input
              type="number"
              min={400}
              max={1600}
              step={10}
              value={profile.target_score ?? ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  target_score: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={inputClass}
              placeholder="1500"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Most recent score</span>
            <input
              type="number"
              min={400}
              max={1600}
              step={10}
              value={profile.current_score ?? ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  current_score: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={inputClass}
              placeholder="1380"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Hours per week</span>
            <input
              type="number"
              min={1}
              max={40}
              value={profile.hours_per_week ?? ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  hours_per_week: e.target.value ? Number(e.target.value) : null,
                })
              }
              className={inputClass}
              placeholder="6"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={generate}
            disabled={!!pending || !hasData}
            className={buttonStyles.primary}
          >
            {plan ? "Regenerate plan" : "Build my study plan"}
          </button>
          <button
            onClick={saveProfile}
            disabled={!!pending}
            className={buttonStyles.secondary}
          >
            Save details
          </button>
          {savedAt && (
            <span className="text-[12.5px] text-[var(--text-muted)]">
              Saved at {savedAt}
            </span>
          )}
        </div>

        {!hasData && (
          <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
            Import some practice questions first -- a plan built on no data is
            just a generic schedule.
          </p>
        )}
        {hasData && diagnosed === 0 && (
          <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
            You have questions logged but no diagnosed mistakes yet. Diagnosing
            them first will make this plan considerably sharper.
          </p>
        )}
      </Card>

      {(daysLeft !== null || profile.target_score) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {daysLeft !== null && (
            <StatTile
              label="Days until test"
              value={daysLeft > 0 ? daysLeft : "Passed"}
              sub={profile.test_date ?? undefined}
              tone={daysLeft <= 21 ? "critical" : daysLeft <= 60 ? "warning" : "neutral"}
            />
          )}
          {profile.target_score && (
            <StatTile
              label="Target score"
              value={profile.target_score}
              sub={
                profile.current_score
                  ? `${profile.target_score - profile.current_score} points to go`
                  : undefined
              }
            />
          )}
          {profile.hours_per_week && (
            <StatTile
              label="Weekly study time"
              value={`${profile.hours_per_week}h`}
              sub={
                daysLeft && daysLeft > 0
                  ? `≈ ${Math.round((daysLeft / 7) * profile.hours_per_week)}h left before the test`
                  : undefined
              }
            />
          )}
        </div>
      )}

      {pending && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
          <span className="pulse size-2 rounded-full bg-[var(--accent)]" aria-hidden />
          <p className="text-[13px] text-[var(--text-secondary)]">{pending}</p>
        </div>
      )}

      {error && (
        <p
          className="rounded-lg border px-4 py-3 text-[13px]"
          style={{
            borderColor: "var(--critical)",
            background: "var(--critical-soft)",
            color: "var(--critical)",
          }}
          role="alert"
        >
          {error}
        </p>
      )}

      {plan && (
        <>
          <Card className="fade-up">
            <CardTitle>The plan</CardTitle>
            <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
              {plan.summary}
            </p>
            {plan.adjustment_note && (
              <p className="mt-4 rounded-lg bg-[var(--accent-soft)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                <span className="font-semibold text-[var(--accent)]">
                  What changed:{" "}
                </span>
                {plan.adjustment_note}
              </p>
            )}
          </Card>

          <Card className="fade-up">
            <CardTitle hint="Share of your weekly study time.">
              Where your time goes
            </CardTitle>
            <ul className="flex flex-col gap-3.5">
              {plan.allocations.map((a) => (
                <li key={`${a.domain}-${a.skill}`}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13.5px] font-medium text-[var(--text-primary)]">
                      {a.skill}
                    </span>
                    <span className="tnum shrink-0 text-[13px] font-semibold text-[var(--accent)]">
                      {Math.round(a.share_of_time)}%
                    </span>
                  </div>
                  <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${a.share_of_time}%`,
                        background: "var(--seq-400)",
                      }}
                    />
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                    {a.rationale}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="fade-up">
            <CardTitle hint="One week, sized to fit the hours you have.">
              This week
            </CardTitle>
            <ol className="flex flex-col divide-y divide-[var(--border)]">
              {plan.sessions.map((s, i) => (
                <li key={i} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="mb-1 flex flex-wrap items-baseline gap-2">
                    <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                      {s.label}
                    </span>
                    <span className="text-[12.5px] text-[var(--text-muted)]">
                      {s.minutes} min · {s.focus}
                    </span>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                    {s.activity}
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                    <span className="font-medium">Done when: </span>
                    {s.success_check}
                  </p>
                </li>
              ))}
            </ol>
          </Card>

          {plan.milestones.length > 0 && (
            <Card className="fade-up">
              <CardTitle>Checkpoints</CardTitle>
              <ul className="flex flex-col gap-2.5">
                {plan.milestones.map((m, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                      <span className="font-medium text-[var(--text-primary)]">
                        {m.when}:{" "}
                      </span>
                      {m.target}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
