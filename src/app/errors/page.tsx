import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import {
  AnswerChip,
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { getErrorLog } from "@/lib/repo";
import { countUndiagnosed } from "@/lib/repo";
import { DOMAINS, MISTAKE_LABELS, type MistakeType } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function ErrorLogPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; skill?: string }>;
}) {
  const params = await searchParams;
  const entries = getErrorLog({
    domain: params.domain,
    skill: params.skill,
  });
  const undiagnosed = countUndiagnosed();

  return (
    <>
      <PageHeader
        title="Error log"
        subtitle="Every question you have missed, with the diagnosis behind it. SATLens flags when a mistake is one you have made before."
        action={
          undiagnosed > 0 ? (
            <ActionButton
              endpoint="/api/analyze"
              body={{ limit: 10 }}
              pendingLabel="Diagnosing..."
            >
              Diagnose {Math.min(undiagnosed, 10)} pending
            </ActionButton>
          ) : undefined
        }
      />

      <FilterBar active={params.domain} />

      {entries.length === 0 ? (
        <EmptyState
          title={params.domain || params.skill ? "Nothing here" : "No mistakes logged yet"}
          body={
            params.domain || params.skill
              ? "No missed questions match this filter. Try clearing it."
              : "Once you import questions and get some wrong, they will collect here with a diagnosis of what went wrong."
          }
          action={
            params.domain || params.skill ? (
              <LinkButton href="/errors" variant="secondary">
                Clear filter
              </LinkButton>
            ) : (
              <LinkButton href="/import">Import practice material</LinkButton>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(({ attempt, diagnosis, priorOccurrences, patterns }) => (
            <Card key={attempt.id} padded={false}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-4 p-4 [&::-webkit-details-marker]:hidden">
                  <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                    <AnswerChip label={attempt.student_answer} variant="chosen" />
                    <span className="text-[var(--text-muted)]" aria-hidden>
                      →
                    </span>
                    <AnswerChip label={attempt.correct_answer} variant="correct" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="tnum text-[12px] text-[var(--text-muted)]">
                        {attempt.occurred_on}
                      </span>
                      {attempt.source_label && (
                        <span className="text-[12px] text-[var(--text-muted)]">
                          · {attempt.source_label}
                        </span>
                      )}
                      {diagnosis ? (
                        <Badge tone="neutral">
                          {MISTAKE_LABELS[diagnosis.mistake_type as MistakeType] ??
                            diagnosis.mistake_type}
                        </Badge>
                      ) : (
                        <Badge tone="warning">Not yet diagnosed</Badge>
                      )}
                      {priorOccurrences > 0 && (
                        <Badge tone="critical">
                          {priorOccurrences + 1}
                          {"× "}
                          this mistake
                        </Badge>
                      )}
                    </div>

                    <p className="text-[14px] font-medium leading-snug text-[var(--text-primary)]">
                      {diagnosis?.headline ?? attempt.question_text.slice(0, 110)}
                    </p>

                    <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">
                      {attempt.domain} › {attempt.skill}
                    </p>
                  </div>

                  <span
                    className="mt-1 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                    aria-hidden
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </summary>

                <div className="border-t border-[var(--border)] px-4 py-4">
                  {attempt.passage && (
                    <div className="mb-4">
                      <SectionLabel>Passage</SectionLabel>
                      <p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-2)] p-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                        {attempt.passage}
                      </p>
                    </div>
                  )}

                  <div className="mb-4">
                    <SectionLabel>Question</SectionLabel>
                    <p className="text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                      {attempt.question_text}
                    </p>
                    {attempt.choices.length > 0 && (
                      <ul className="mt-2.5 flex flex-col gap-1.5">
                        {attempt.choices.map((c) => {
                          const isChosen =
                            c.label.toLowerCase() ===
                            attempt.student_answer.toLowerCase();
                          const isCorrect =
                            c.label.toLowerCase() ===
                            attempt.correct_answer.toLowerCase();
                          return (
                            <li
                              key={c.label}
                              className="flex gap-2.5 rounded-md px-2 py-1.5 text-[13px] leading-relaxed"
                              style={{
                                background: isCorrect
                                  ? "var(--good-soft)"
                                  : isChosen
                                    ? "var(--critical-soft)"
                                    : "transparent",
                              }}
                            >
                              <span
                                className="font-semibold"
                                style={{
                                  color: isCorrect
                                    ? "var(--good)"
                                    : isChosen
                                      ? "var(--critical)"
                                      : "var(--text-muted)",
                                }}
                              >
                                {c.label}.
                              </span>
                              <span className="text-[var(--text-secondary)]">
                                {c.text}
                              </span>
                              {isCorrect && (
                                <span className="ml-auto shrink-0 text-[11.5px] font-medium" style={{ color: "var(--good)" }}>
                                  correct
                                </span>
                              )}
                              {isChosen && !isCorrect && (
                                <span className="ml-auto shrink-0 text-[11.5px] font-medium" style={{ color: "var(--critical)" }}>
                                  you picked this
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {attempt.student_reasoning && (
                    <div className="mb-4">
                      <SectionLabel>Your reasoning at the time</SectionLabel>
                      <p className="text-[13px] italic leading-relaxed text-[var(--text-secondary)]">
                        “{attempt.student_reasoning}”
                      </p>
                    </div>
                  )}

                  {diagnosis ? (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
                      <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.055em] text-[var(--accent)]">
                        SATLens diagnosis
                      </p>

                      <p className="mb-3 text-[13.5px] font-medium leading-snug text-[var(--text-primary)]">
                        {diagnosis.headline}
                      </p>

                      <div className="flex flex-col gap-3">
                        <Detail label="What happened">
                          {diagnosis.explanation}
                        </Detail>
                        <Detail label="The concept to lock in">
                          {diagnosis.concept}
                        </Detail>
                        {diagnosis.trap && (
                          <Detail label="The trap">{diagnosis.trap}</Detail>
                        )}
                        {diagnosis.faster_solution && (
                          <Detail label="A faster route">
                            {diagnosis.faster_solution}
                          </Detail>
                        )}
                      </div>

                      {patterns.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
                          <span className="text-[12px] text-[var(--text-muted)]">
                            Part of:
                          </span>
                          {patterns.map((p) => (
                            <Link
                              key={p.id}
                              href={`/patterns/${p.id}`}
                              className="text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                            >
                              {p.title}
                            </Link>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <LinkButton
                          href={`/practice?skill=${encodeURIComponent(attempt.skill)}`}
                          variant="secondary"
                        >
                          Practice this skill
                        </LinkButton>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-[var(--border-strong)] p-4">
                      <p className="text-[13px] text-[var(--text-secondary)]">
                        This mistake has not been diagnosed yet.
                      </p>
                      <ActionButton
                        endpoint="/api/analyze"
                        body={{ attemptId: attempt.id }}
                        pendingLabel="Diagnosing..."
                        variant="secondary"
                      >
                        Diagnose this one
                      </ActionButton>
                    </div>
                  )}
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">
      {children}
    </p>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11.5px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
        {children}
      </p>
    </div>
  );
}

function FilterBar({ active }: { active?: string }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      <Link
        href="/errors"
        className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
          !active
            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
            : "bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
        }`}
      >
        All domains
      </Link>
      {DOMAINS.map((d) => (
        <Link
          key={d.name}
          href={`/errors?domain=${encodeURIComponent(d.name)}`}
          className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
            active === d.name
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
          }`}
        >
          {d.name}
        </Link>
      ))}
    </div>
  );
}
