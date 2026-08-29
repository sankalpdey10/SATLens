import Link from "next/link";
import { AccuracyTrendChart, MistakeMixChart } from "@/components/charts";
import { ActionButton } from "@/components/ActionButton";
import {
  AccuracyBar,
  Badge,
  Card,
  CardTitle,
  EmptyState,
  LinkButton,
  PageHeader,
  PatternStatusBadge,
  StatTile,
  accuracyTone,
} from "@/components/ui";
import { listPatterns } from "@/lib/repo";
import {
  MIN_SAMPLE,
  getAccuracyOverTime,
  getDomainStats,
  getMistakeBreakdown,
  getOverview,
  getStrongestSkills,
  getWeakestSkills,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const overview = getOverview();

  if (overview.total === 0) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          subtitle="SATLens turns your practice history into a map of what you actually need to fix."
        />
        <EmptyState
          icon={
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m20 20-4.5-4.5" />
            </svg>
          }
          title="No practice data yet"
          body="Import a practice test, paste an answer log, or add questions by hand. Once SATLens has a few wrong answers to look at, it can start finding the patterns behind them."
          action={<LinkButton href="/import">Import practice material</LinkButton>}
        />
      </>
    );
  }

  const domains = getDomainStats();
  const weakest = getWeakestSkills(5);
  const strongest = getStrongestSkills(4);
  const patterns = listPatterns();
  const trend = getAccuracyOverTime();
  const mistakes = getMistakeBreakdown();
  const accuracyPct = Math.round((overview.accuracy ?? 0) * 100);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          overview.firstDate
            ? `${overview.total} questions analyzed across ${overview.daysActive} practice ${overview.daysActive === 1 ? "day" : "days"}, ${overview.firstDate} to ${overview.lastDate}.`
            : undefined
        }
        action={<LinkButton href="/import" variant="secondary">Import more</LinkButton>}
      />

      <NextStep overview={overview} patternCount={patterns.length} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Overall accuracy"
          value={`${accuracyPct}%`}
          sub={`${overview.correct} of ${overview.total} correct`}
          tone={accuracyTone(overview.accuracy ?? 0)}
        />
        <StatTile
          label="Questions analyzed"
          value={overview.total}
          sub={
            overview.undiagnosed > 0
              ? `${overview.undiagnosed} wrong ${overview.undiagnosed === 1 ? "answer" : "answers"} not yet diagnosed`
              : `${overview.diagnosed} mistakes diagnosed`
          }
        />
        <StatTile
          label="Active patterns"
          value={overview.activePatterns}
          sub={
            overview.patterns > 0
              ? `${overview.patterns} detected in total`
              : "Run pattern detection to find them"
          }
          tone={overview.activePatterns > 0 ? "critical" : "neutral"}
        />
        <StatTile
          label="Resolving"
          value={overview.resolvedPatterns}
          sub="Patterns your recent work has cleared"
          tone={overview.resolvedPatterns > 0 ? "good" : "neutral"}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardTitle hint="Day-to-day accuracy is noisy; the cumulative line is the real trend.">
            Improvement over time
          </CardTitle>
          <AccuracyTrendChart data={trend} />
        </Card>

        <Card>
          <CardTitle hint="Across every diagnosed mistake.">
            Why you lose points
          </CardTitle>
          <MistakeMixChart data={mistakes} />
        </Card>
      </div>

      {/* Patterns are the product's core answer to "why", so they sit above
          the domain breakdown rather than below it. */}
      <Card className="mb-6">
        <CardTitle
          hint="Recurring mechanisms found across multiple questions -- not just topics you score low on."
          action={
            patterns.length > 0 ? (
              <Link
                href="/patterns"
                className="text-[13px] font-medium text-[var(--accent)] hover:underline"
              >
                View all
              </Link>
            ) : undefined
          }
        >
          Recurring mistake patterns
        </CardTitle>

        {patterns.length === 0 ? (
          <div className="rounded-lg bg-[var(--surface-2)] px-4 py-6 text-center">
            <p className="text-[13px] text-[var(--text-secondary)]">
              {overview.diagnosed < 3
                ? `Diagnose at least 3 wrong answers and SATLens can start looking for patterns. You have ${overview.diagnosed}.`
                : "You have enough diagnosed mistakes to look for patterns."}
            </p>
            {overview.diagnosed >= 3 && (
              <div className="mt-3 flex justify-center">
                <ActionButton
                  endpoint="/api/patterns/detect"
                  pendingLabel="Analyzing your history..."
                >
                  Detect patterns
                </ActionButton>
              </div>
            )}
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {patterns.slice(0, 3).map((p) => (
              <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                <Link href={`/patterns/${p.id}`} className="group block">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[14px] font-medium leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                      {p.title}
                    </h3>
                    <PatternStatusBadge status={p.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {p.description}
                  </p>
                  <p className="mt-1.5 text-[12px] text-[var(--text-muted)]">
                    {p.domain}
                    {p.skill ? ` › ${p.skill}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <CardTitle hint="Click any skill for the deeper breakdown.">
          Performance by domain
        </CardTitle>
        <div className="flex flex-col gap-5">
          {domains.map((d) => (
            <div key={d.domain}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                  {d.domain}
                  <span className="ml-2 text-[11.5px] font-normal text-[var(--text-muted)]">
                    {d.section}
                  </span>
                </h3>
              </div>
              <AccuracyBar
                accuracy={d.accuracy}
                total={d.total}
                correct={d.correct}
              />
              <ul className="mt-2.5 flex flex-col gap-1.5 border-l border-[var(--border)] pl-4">
                {d.skills.map((s) => (
                  <li key={s.skill}>
                    <Link
                      href={`/skills/${s.slug}`}
                      className="group grid grid-cols-[minmax(0,1fr)_240px] items-center gap-3 rounded-md py-0.5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13px] text-[var(--text-secondary)] group-hover:text-[var(--accent)]">
                          {s.skill}
                        </span>
                        {s.patternCount > 0 && (
                          <Badge tone="critical">
                            {s.patternCount} pattern
                            {s.patternCount > 1 ? "s" : ""}
                          </Badge>
                        )}
                        {s.total < MIN_SAMPLE && (
                          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                            low data
                          </span>
                        )}
                      </span>
                      <AccuracyBar
                        accuracy={s.accuracy}
                        total={s.total}
                        correct={s.correct}
                        compact
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle hint={`Lowest accuracy, minimum ${MIN_SAMPLE} questions.`}>
            Where you are losing the most points
          </CardTitle>
          {weakest.length ? (
            <ul className="flex flex-col gap-3">
              {weakest.map((s) => (
                <li key={s.skill}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <Link
                      href={`/skills/${s.slug}`}
                      className="truncate text-[13.5px] font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                    >
                      {s.skill}
                    </Link>
                    <Link
                      href={`/practice?skill=${encodeURIComponent(s.skill)}`}
                      className="shrink-0 text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                    >
                      Practice this skill
                    </Link>
                  </div>
                  <AccuracyBar
                    accuracy={s.accuracy}
                    total={s.total}
                    correct={s.correct}
                    compact
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[var(--text-muted)]">
              Not enough data yet -- a skill needs at least {MIN_SAMPLE} questions
              before SATLens will call it a weakness.
            </p>
          )}
        </Card>

        <Card>
          <CardTitle hint={`Highest accuracy, minimum ${MIN_SAMPLE} questions.`}>
            What you are already good at
          </CardTitle>
          {strongest.length ? (
            <ul className="flex flex-col gap-3">
              {strongest.map((s) => (
                <li key={s.skill}>
                  <Link
                    href={`/skills/${s.slug}`}
                    className="mb-1 block truncate text-[13.5px] font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                  >
                    {s.skill}
                  </Link>
                  <AccuracyBar
                    accuracy={s.accuracy}
                    total={s.total}
                    correct={s.correct}
                    compact
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[var(--text-muted)]">
              Not enough data yet.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

/**
 * A single, unambiguous next action. The product's promise is "tell me what to
 * do next", so the dashboard should never leave that to inference.
 */
function NextStep({
  overview,
  patternCount,
}: {
  overview: ReturnType<typeof getOverview>;
  patternCount: number;
}) {
  let title: string;
  let body: string;
  let action: React.ReactNode;

  if (overview.undiagnosed > 0) {
    title = `${overview.undiagnosed} wrong ${overview.undiagnosed === 1 ? "answer is" : "answers are"} waiting to be diagnosed`;
    body =
      "SATLens can only find patterns in mistakes it has analyzed. Run the diagnosis to find out why you missed these.";
    action = (
      <ActionButton
        endpoint="/api/analyze"
        body={{ limit: 10 }}
        pendingLabel="Diagnosing mistakes..."
      >
        Analyze {Math.min(overview.undiagnosed, 10)} mistakes
      </ActionButton>
    );
  } else if (patternCount === 0 && overview.diagnosed >= 3) {
    title = "Your mistakes are diagnosed -- now find the patterns";
    body =
      "SATLens will look across every diagnosed mistake for the same reasoning error recurring, and show you the questions that prove it.";
    action = (
      <ActionButton
        endpoint="/api/patterns/detect"
        pendingLabel="Analyzing your history..."
      >
        Detect patterns
      </ActionButton>
    );
  } else if (overview.activePatterns > 0) {
    title = `${overview.activePatterns} active ${overview.activePatterns === 1 ? "pattern is" : "patterns are"} still costing you points`;
    body =
      "Work through targeted practice built around each pattern. SATLens marks a pattern as resolving once you stop falling for it.";
    action = <LinkButton href="/patterns">View your patterns</LinkButton>;
  } else if (overview.diagnosed < 3) {
    title = "Add a few more questions";
    body = `Pattern detection needs at least 3 diagnosed mistakes to say anything meaningful. You have ${overview.diagnosed}.`;
    action = <LinkButton href="/import">Import more questions</LinkButton>;
  } else {
    title = "You are on top of everything SATLens has found";
    body =
      "Import a fresh practice test to keep the analysis current, or keep drilling your weakest skills.";
    action = <LinkButton href="/import">Import a practice test</LinkButton>;
  }

  return (
    <div className="fade-up mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-5">
      <div className="min-w-0">
        <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.055em] text-[var(--accent)]">
          Next step
        </p>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {body}
        </p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
