"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge, Card, CardTitle, buttonStyles } from "./ui";

interface Choice {
  label: string;
  text: string;
}

interface PracticeItem {
  id: string;
  section: string;
  domain: string;
  skill: string;
  difficulty: string;
  pattern_id: string | null;
  passage: string | null;
  question_text: string;
  choices: Choice[];
  correct_answer: string;
  rationales: Record<string, string>;
  teaching_point: string;
  faster_approach: string | null;
}

interface Result {
  verdict: "overcame" | "partial" | "repeated";
  feedback: string;
  reasoning_assessment: string | null;
  next_step: string;
  isCorrect: boolean;
  correctAnswer: string;
  rationales: Record<string, string>;
  teachingPoint: string;
  fasterApproach: string | null;
}

const VERDICT = {
  overcame: {
    label: "You have beaten this pattern here",
    tone: "good" as const,
    color: "var(--good)",
    soft: "var(--good-soft)",
  },
  partial: {
    label: "Partly there",
    tone: "warning" as const,
    color: "var(--serious)",
    soft: "var(--warning-soft)",
  },
  repeated: {
    label: "The same mistake happened again",
    tone: "critical" as const,
    color: "var(--critical)",
    soft: "var(--critical-soft)",
  },
};

const inputClass =
  "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 py-2 text-[13.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]";

export function PracticeSession({
  initialSkill,
  patternId,
  patternTitle,
  domains,
}: {
  initialSkill: string;
  patternId: string | null;
  patternTitle: string | null;
  skills: { name: string; domain: string }[];
  domains: { section: string; domain: string; skills: string[] }[];
}) {
  const router = useRouter();
  const [skill, setSkill] = useState(initialSkill);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [item, setItem] = useState<PracticeItem | null>(null);
  const [answer, setAnswer] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef<number | null>(null);

  // Keep the picker in sync when navigating here from a different skill's page.
  useEffect(() => setSkill(initialSkill), [initialSkill]);

  async function generate() {
    setPending("Writing a question that targets this weakness...");
    setError(null);
    setResult(null);
    setAnswer("");
    setReasoning("");
    setItem(null);
    try {
      const response = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill, difficulty, patternId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not generate a question");
      setItem(data);
      startedAt.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  async function submit() {
    if (!item || !answer) return;
    setPending("Evaluating your answer and your reasoning...");
    setError(null);
    try {
      const response = await fetch("/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          answer,
          reasoning,
          timeSpentSeconds: startedAt.current
            ? Math.round((Date.now() - startedAt.current) / 1000)
            : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not evaluate");
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle
          hint={
            patternTitle
              ? "Locked to the pattern you came from."
              : "Pick what to drill. Your weakest skill is preselected."
          }
        >
          What are we working on?
        </CardTitle>

        {patternTitle && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--accent-soft)] px-3 py-2.5">
            <Badge tone="accent">Retest</Badge>
            <span className="text-[13px] font-medium text-[var(--text-primary)]">
              {patternTitle}
            </span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">
              Skill
            </span>
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              className={inputClass}
            >
              <option value="">Select a skill...</option>
              {domains.map((d) => (
                <optgroup key={d.domain} label={`${d.section} › ${d.domain}`}>
                  {d.skills.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">
              Difficulty
            </span>
            <select
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value as "easy" | "medium" | "hard")
              }
              className={inputClass}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <button
            onClick={generate}
            disabled={!skill || !!pending}
            className={buttonStyles.primary}
          >
            {item ? "New question" : "Generate question"}
          </button>
        </div>
      </Card>

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

      {item && (
        <Card className="fade-up">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{item.skill}</Badge>
            <Badge tone="neutral">{item.difficulty}</Badge>
            <span className="text-[12px] text-[var(--text-muted)]">
              Original question generated for you
            </span>
          </div>

          {item.passage && (
            <p className="mb-4 whitespace-pre-wrap rounded-lg bg-[var(--surface-2)] p-4 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
              {item.passage}
            </p>
          )}

          <p className="mb-4 text-[14.5px] font-medium leading-relaxed text-[var(--text-primary)]">
            {item.question_text}
          </p>

          <ul className="mb-5 flex flex-col gap-2">
            {item.choices.map((c) => {
              const selected = answer === c.label;
              const isCorrect = result && c.label === result.correctAnswer;
              const isWrongPick = result && selected && !result.isCorrect;

              return (
                <li key={c.label}>
                  <button
                    onClick={() => !result && setAnswer(c.label)}
                    disabled={!!result}
                    className="flex w-full gap-3 rounded-lg border p-3 text-left transition-colors"
                    style={{
                      borderColor: isCorrect
                        ? "var(--good)"
                        : isWrongPick
                          ? "var(--critical)"
                          : selected
                            ? "var(--accent)"
                            : "var(--border)",
                      background: isCorrect
                        ? "var(--good-soft)"
                        : isWrongPick
                          ? "var(--critical-soft)"
                          : selected
                            ? "var(--accent-soft)"
                            : "transparent",
                    }}
                  >
                    <span
                      className="tnum grid size-6 shrink-0 place-items-center rounded-md text-[12.5px] font-semibold"
                      style={{
                        background: isCorrect
                          ? "var(--good)"
                          : isWrongPick
                            ? "var(--critical)"
                            : selected
                              ? "var(--accent)"
                              : "var(--surface-2)",
                        color:
                          isCorrect || isWrongPick || selected
                            ? "var(--accent-ink)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {c.label}
                    </span>
                    <span className="text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                      {c.text}
                    </span>
                  </button>

                  {result && (
                    <p className="mt-1.5 pl-9 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                      {result.rationales[c.label]}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {!result && (
            <>
              <label className="mb-4 block">
                <span className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">
                  Why did you pick that? (optional)
                </span>
                <textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-y`}
                  placeholder="Explaining your thinking lets SATLens tell a real fix from a lucky guess."
                />
              </label>

              <button
                onClick={submit}
                disabled={!answer || !!pending}
                className={buttonStyles.primary}
              >
                Submit answer
              </button>
            </>
          )}
        </Card>
      )}

      {result && item && (
        <Card className="fade-up">
          <div
            className="mb-4 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2.5"
            style={{ background: VERDICT[result.verdict].soft }}
          >
            <span
              className="text-[13.5px] font-semibold"
              style={{ color: VERDICT[result.verdict].color }}
            >
              {result.isCorrect ? "Correct" : "Incorrect"} — {VERDICT[result.verdict].label}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <Block label="What this tells us">{result.feedback}</Block>
            {result.reasoning_assessment && (
              <Block label="On your reasoning">{result.reasoning_assessment}</Block>
            )}
            <Block label="The takeaway">{result.teachingPoint}</Block>
            {result.fasterApproach && (
              <Block label="A faster route">{result.fasterApproach}</Block>
            )}
            <Block label="Do this next">{result.next_step}</Block>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={generate} className={buttonStyles.primary}>
              Another question on this skill
            </button>
            <a href="/patterns" className={buttonStyles.secondary}>
              Back to patterns
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}

function Block({
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
