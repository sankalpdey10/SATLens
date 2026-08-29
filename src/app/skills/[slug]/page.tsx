import Link from "next/link";
import { notFound } from "next/navigation";
import { AccuracyTrendChart, MistakeMixChart } from "@/components/charts";
import {
  AnswerChip,
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
import { FasterSolutions } from "@/components/FasterSolutions";
import { getErrorLog, patternsForSkill } from "@/lib/repo";
import {
  MIN_SAMPLE,
  getAccuracyOverTime,
  getMistakeBreakdown,
  getSkillStat,
} from "@/lib/stats";
import { findSkill } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function SkillPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = findSkill(slug);
  if (!skill) notFound();

  const stat = getSkillStat(skill.name);
  const patterns = patternsForSkill(skill.name);
  const errors = getErrorLog({ skill: skill.name });
  const trend = getAccuracyOverTime(skill.name);
  const mistakes = getMistakeBreakdown(skill.name);

  const practiceHref = `/practice?skill=${encodeURIComponent(skill.name)}`;

  return (
    <>
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m15 18-6-6 6-6" />
        </svg>
        Dashboard
      </Link>

      <PageHeader
        title={skill.name}
        subtitle={
          <>
            <span className="block">{skill.blurb}</span>
            <span className="mt-1 block text-[12.5px] text-[var(--text-muted)]">
              {skill.section} › {skill.domain}
            </span>
          </>
        }
        action={<LinkButton href={practiceHref}>Practice this skill</LinkButton>}
      />

      {!stat ? (
        <EmptyState
          title="No questions logged for this skill"
          body="Import questions tagged with this skill, or generate targeted practice to start building a picture of how you handle it."
          action={<LinkButton href={practiceHref}>Generate practice</LinkButton>}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Accuracy"
              value={`${Math.round(stat.accuracy * 100)}%`}
              sub={`${stat.correct} of ${stat.total} correct`}
              tone={accuracyTone(stat.accuracy)}
            />
            <StatTile
              label="Questions seen"
              value={stat.total}
              sub={
                stat.total < MIN_SAMPLE
                  ? `Below the ${MIN_SAMPLE}-question threshold for a reliable read`
                  : "Enough data for a reliable read"
              }
            />
            <StatTile
              label="Patterns here"
              value={patterns.length}
              sub={
                patterns.length
                  ? "Recurring mechanisms found in this skill"
                  : "No recurring pattern detected"
              }
              tone={patterns.length ? "critical" : "neutral"}
            />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardTitle hint="Only questions tagged with this skill.">
                Accuracy on this skill over time
              </CardTitle>
              <AccuracyTrendChart data={trend} />
            </Card>
            <Card>
              <CardTitle hint="Across your diagnosed mistakes in this skill.">
                How you miss these
              </CardTitle>
              <MistakeMixChart data={mistakes} />
            </Card>
          </div>

          {patterns.length > 0 && (
            <Card className="mb-6">
              <CardTitle hint="The specific reasoning habits behind these misses.">
                Patterns in this skill
              </CardTitle>
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {patterns.map((p) => (
                  <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                      <Link
                        href={`/patterns/${p.id}`}
                        className="text-[14px] font-medium leading-snug text-[var(--text-primary)] hover:text-[var(--accent)]"
                      >
                        {p.title}
                      </Link>
                      <PatternStatusBadge status={p.status} />
                    </div>
                    <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      {p.description}
                    </p>
                    <div className="mt-2 flex gap-3">
                      <Link
                        href={`/patterns/${p.id}`}
                        className="text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                      >
                        View pattern
                      </Link>
                      <Link
                        href={`/practice?pattern=${p.id}&skill=${encodeURIComponent(skill.name)}`}
                        className="text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                      >
                        Retest it
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="mb-6">
            <CardTitle hint="Efficiency opportunities pulled from your own missed questions, not a generic tips list.">
              Could you have solved these faster?
            </CardTitle>
            <FasterSolutions skill={skill.name} enabled={errors.length >= 3} />
          </Card>

          {errors.length > 0 && (
            <Card>
              <CardTitle
                action={
                  <Link
                    href={`/errors?skill=${encodeURIComponent(skill.name)}`}
                    className="text-[13px] font-medium text-[var(--accent)] hover:underline"
                  >
                    Full error log
                  </Link>
                }
              >
                Questions you missed here
              </CardTitle>
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {errors.slice(0, 6).map(({ attempt, diagnosis, priorOccurrences }) => (
                  <li key={attempt.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                      <AnswerChip label={attempt.student_answer} variant="chosen" />
                      <AnswerChip label={attempt.correct_answer} variant="correct" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] leading-snug text-[var(--text-primary)]">
                        {diagnosis?.headline ?? attempt.question_text.slice(0, 110)}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-muted)]">
                        <span className="tnum">{attempt.occurred_on}</span>
                        {priorOccurrences > 0 && (
                          <Badge tone="critical">Repeat mistake</Badge>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

        </>
      )}
    </>
  );
}
