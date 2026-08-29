import Link from "next/link";
import { notFound } from "next/navigation";
import { RetestTimeline } from "@/components/charts";
import {
  AnswerChip,
  Badge,
  Card,
  CardTitle,
  Divider,
  LinkButton,
  PageHeader,
  PatternStatusBadge,
  StatTile,
} from "@/components/ui";
import { getDiagnosis, getPattern } from "@/lib/repo";
import { MISTAKE_LABELS, type MistakeType } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function PatternDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pattern = getPattern(id);
  if (!pattern) notFound();

  const retestCorrect = pattern.retests.filter((r) => r.isCorrect).length;
  const retestRate = pattern.retests.length
    ? retestCorrect / pattern.retests.length
    : null;

  return (
    <>
      <Link
        href="/patterns"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m15 18-6-6 6-6" />
        </svg>
        All patterns
      </Link>

      <PageHeader
        title={pattern.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <PatternStatusBadge status={pattern.status} />
            <Badge
              tone={
                pattern.severity === "high"
                  ? "critical"
                  : pattern.severity === "moderate"
                    ? "warning"
                    : "neutral"
              }
            >
              {pattern.severity} impact
            </Badge>
            {pattern.mistake_type && (
              <Badge tone="neutral">
                {MISTAKE_LABELS[pattern.mistake_type as MistakeType] ??
                  pattern.mistake_type}
              </Badge>
            )}
            <span className="text-[12.5px] text-[var(--text-muted)]">
              {pattern.domain}
              {pattern.skill ? ` › ${pattern.skill}` : ""}
            </span>
          </span>
        }
        action={
          pattern.skill ? (
            <LinkButton
              href={`/practice?pattern=${pattern.id}&skill=${encodeURIComponent(pattern.skill)}`}
            >
              Practice this pattern
            </LinkButton>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Questions as evidence"
          value={pattern.evidence.length}
          sub={`${pattern.first_seen} to ${pattern.last_seen}`}
        />
        <StatTile
          label="Since detection"
          value={
            pattern.retests.length
              ? `${retestCorrect}/${pattern.retests.length}`
              : "—"
          }
          sub={
            pattern.retests.length
              ? "attempts on this skill since the last occurrence"
              : "No attempts on this skill yet"
          }
          tone={
            retestRate === null
              ? "neutral"
              : retestRate >= 0.8
                ? "good"
                : retestRate >= 0.6
                  ? "warning"
                  : "critical"
          }
        />
        <StatTile
          label="Status"
          value={
            pattern.status === "resolved"
              ? "Resolving"
              : pattern.status === "improving"
                ? "Improving"
                : "Active"
          }
          sub={
            pattern.status === "resolved"
              ? "Your recent work suggests this is fixed"
              : pattern.status === "improving"
                ? "Trending the right way -- keep going"
                : "Still costing you points"
          }
          tone={
            pattern.status === "resolved"
              ? "good"
              : pattern.status === "improving"
                ? "warning"
                : "critical"
          }
        />
      </div>

      <Card className="mb-6">
        <CardTitle>What is happening</CardTitle>
        <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
          {pattern.description}
        </p>

        <Divider />

        <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.055em] text-[var(--accent)]">
          What to do instead
        </p>
        <p className="text-[14px] leading-relaxed text-[var(--text-primary)]">
          {pattern.recommendation}
        </p>
      </Card>

      <Card className="mb-6">
        <CardTitle hint="Every attempt on this skill after the pattern's most recent occurrence. This is what 'improving' is measured on.">
          Are you fixing it?
        </CardTitle>
        <RetestTimeline
          attempts={pattern.retests.map((r) => ({
            id: r.id,
            occurred_on: r.occurred_on,
            isCorrect: r.isCorrect,
          }))}
        />
        {pattern.skill && (
          <div className="mt-4">
            <LinkButton
              href={`/practice?pattern=${pattern.id}&skill=${encodeURIComponent(pattern.skill)}`}
              variant="secondary"
            >
              Generate a question that tests this exact habit
            </LinkButton>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle hint="The specific questions that established this pattern.">
          The evidence
        </CardTitle>

        <ol className="flex flex-col gap-3">
          {pattern.evidence.map(({ attempt, note }, index) => {
            const diagnosis = getDiagnosis(attempt.id);
            return (
              <li
                key={attempt.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="tnum grid size-5 place-items-center rounded bg-[var(--surface-1)] text-[11px] font-semibold text-[var(--text-muted)]">
                    {index + 1}
                  </span>
                  <span className="tnum text-[12px] text-[var(--text-muted)]">
                    {attempt.occurred_on}
                  </span>
                  {attempt.source_label && (
                    <span className="text-[12px] text-[var(--text-muted)]">
                      · {attempt.source_label}
                    </span>
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    <AnswerChip label={attempt.student_answer} variant="chosen" />
                    <span className="text-[var(--text-muted)]" aria-hidden>
                      →
                    </span>
                    <AnswerChip label={attempt.correct_answer} variant="correct" />
                  </span>
                </div>

                <p className="mb-2.5 text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                  {attempt.question_text}
                </p>

                {note && (
                  <p className="mb-2.5 border-l-2 border-[var(--accent)] pl-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--accent)]">
                      How this fits the pattern:{" "}
                    </span>
                    {note}
                  </p>
                )}

                {diagnosis && (
                  <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                    Diagnosis: {diagnosis.headline}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </>
  );
}
