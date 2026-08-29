"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Badge, Card, buttonStyles } from "./ui";

/* ------------------------------------------------------------------- types */

interface TaxonomyEntry {
  section: string;
  domain: string;
  skills: string[];
}

interface Choice {
  label: string;
  text: string;
}

interface DraftQuestion {
  key: string;
  section: string;
  domain: string;
  skill: string;
  difficulty: "easy" | "medium" | "hard" | "";
  passage: string;
  question_text: string;
  choices: Choice[];
  student_answer: string;
  correct_answer: string;
  student_reasoning: string;
  confidence: number | null;
  include: boolean;
}

type Mode = "manual" | "paste" | "pdf";

const EMPTY_CHOICES: Choice[] = [
  { label: "A", text: "" },
  { label: "B", text: "" },
  { label: "C", text: "" },
  { label: "D", text: "" },
];

let keyCounter = 0;
const nextKey = () => `draft-${++keyCounter}`;

/* -------------------------------------------------------------- form atoms */

const inputClass =
  "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 py-2 text-[13.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]";

const labelClass =
  "mb-1.5 block text-[11.5px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11.5px] text-[var(--text-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}

/* --------------------------------------------------------------- component */

export function ImportWorkbench({ taxonomy }: { taxonomy: TaxonomyEntry[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("manual");
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  // Shared across every import mode.
  const [occurredOn, setOccurredOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [sourceLabel, setSourceLabel] = useState("");

  const skillIndex = useMemo(() => {
    const map = new Map<string, TaxonomyEntry>();
    for (const entry of taxonomy) {
      for (const skill of entry.skills) map.set(skill, entry);
    }
    return map;
  }, [taxonomy]);

  function updateDraft(key: string, patch: Partial<DraftQuestion>) {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.key !== key) return d;
        const next = { ...d, ...patch };
        // Keep section/domain in lockstep with the chosen skill.
        if (patch.skill) {
          const entry = skillIndex.get(patch.skill);
          if (entry) {
            next.section = entry.section;
            next.domain = entry.domain;
          }
        }
        return next;
      }),
    );
  }

  function problemsFor(d: DraftQuestion): string[] {
    const problems: string[] = [];
    if (!d.skill || !skillIndex.has(d.skill)) problems.push("Pick a skill");
    if (!d.question_text.trim()) problems.push("Missing question text");
    if (!d.student_answer.trim()) problems.push("Missing your answer");
    if (!d.correct_answer.trim()) problems.push("Missing correct answer");
    return problems;
  }

  const includable = drafts.filter((d) => d.include);
  const readyCount = includable.filter((d) => problemsFor(d).length === 0).length;
  const blockedCount = includable.length - readyCount;

  /* ------------------------------------------------------------ extraction */

  async function extractText(text: string) {
    setBusy("Reading and classifying your questions...");
    setError(null);
    setSaved(null);
    try {
      const response = await fetch("/api/import/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Extraction failed");
      ingest(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(null);
    }
  }

  async function extractPdf(file: File, answerKey: string) {
    setBusy(`Reading ${file.name}...`);
    setError(null);
    setSaved(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (answerKey.trim()) form.append("answerKey", answerKey);
      const response = await fetch("/api/import/pdf", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Extraction failed");
      ingest(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(null);
    }
  }

  interface ExtractedPayload {
    notes?: string | null;
    questions?: {
      section: string;
      domain: string;
      skill: string;
      difficulty: "easy" | "medium" | "hard" | null;
      passage: string | null;
      question_text: string;
      choices: Choice[];
      student_answer: string | null;
      correct_answer: string | null;
      student_reasoning: string | null;
      classification_confidence: number;
    }[];
  }

  function ingest(data: ExtractedPayload) {
    setNotes(data.notes ?? null);
    const incoming = (data.questions ?? []).map<DraftQuestion>((q) => ({
      key: nextKey(),
      section: q.section,
      domain: q.domain,
      skill: q.skill,
      difficulty: q.difficulty ?? "",
      passage: q.passage ?? "",
      question_text: q.question_text,
      choices: q.choices?.length ? q.choices : [],
      student_answer: q.student_answer ?? "",
      correct_answer: q.correct_answer ?? "",
      student_reasoning: q.student_reasoning ?? "",
      confidence: q.classification_confidence,
      include: true,
    }));
    setDrafts((prev) => [...prev, ...incoming]);
    if (!incoming.length && !data.notes) {
      setError("No SAT questions were found in that material.");
    }
  }

  /* ----------------------------------------------------------------- save */

  async function save() {
    setBusy("Saving...");
    setError(null);
    try {
      const payload = includable
        .filter((d) => problemsFor(d).length === 0)
        .map((d) => ({
          occurred_on: occurredOn,
          source: mode === "pdf" ? ("pdf" as const) : ("manual" as const),
          source_label: sourceLabel.trim() || null,
          section: d.section,
          domain: d.domain,
          skill: d.skill,
          difficulty: d.difficulty || null,
          passage: d.passage.trim() || null,
          question_text: d.question_text,
          choices: d.choices.filter((c) => c.text.trim()),
          student_answer: d.student_answer,
          correct_answer: d.correct_answer,
          student_reasoning: d.student_reasoning.trim() || null,
        }));

      const response = await fetch("/api/import/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: payload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Save failed");

      setSaved(data.saved);
      setDrafts([]);
      setNotes(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  /* ----------------------------------------------------------------- view */

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-1">
        {(
          [
            ["manual", "Add by hand"],
            ["paste", "Paste text"],
            ["pdf", "Upload PDF"],
          ] as [Mode, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              mode === value
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <Field label="Date practiced" hint="Backdate this to when you actually took the test.">
            <input
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Source label" hint="Optional, e.g. 'Practice Test 4'.">
            <input
              type="text"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder="Practice Test 4"
              className={inputClass}
            />
          </Field>
        </div>

        {mode === "manual" && (
          <ManualForm
            taxonomy={taxonomy}
            onAdd={(draft) => {
              setSaved(null);
              setDrafts((prev) => [...prev, draft]);
            }}
          />
        )}
        {mode === "paste" && <PasteForm onExtract={extractText} busy={!!busy} />}
        {mode === "pdf" && <PdfForm onExtract={extractPdf} busy={!!busy} />}
      </Card>

      {busy && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
          <span className="pulse size-2 rounded-full bg-[var(--accent)]" aria-hidden />
          <p className="text-[13px] text-[var(--text-secondary)]">{busy}</p>
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

      {saved !== null && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
          style={{ borderColor: "var(--good)", background: "var(--good-soft)" }}
        >
          <p className="text-[13px] font-medium" style={{ color: "var(--good)" }}>
            Saved {saved} question{saved === 1 ? "" : "s"}.
          </p>
          <a href="/" className={buttonStyles.secondary}>
            Go to dashboard
          </a>
        </div>
      )}

      {notes && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">
            Note from the extraction:{" "}
          </span>
          {notes}
        </p>
      )}

      {drafts.length > 0 && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
                Review before saving
              </h2>
              <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
                {readyCount} ready
                {blockedCount > 0 && `, ${blockedCount} need attention`}. Nothing is
                saved until you confirm.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDrafts([]);
                  setNotes(null);
                }}
                className={buttonStyles.ghost}
              >
                Discard all
              </button>
              <button
                onClick={save}
                disabled={readyCount === 0 || !!busy}
                className={buttonStyles.primary}
              >
                Save {readyCount} question{readyCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>

          <ul className="flex flex-col gap-3">
            {drafts.map((d, index) => {
              const problems = problemsFor(d);
              return (
                <li
                  key={d.key}
                  className={`rounded-lg border p-4 ${
                    d.include
                      ? "border-[var(--border)] bg-[var(--surface-2)]"
                      : "border-dashed border-[var(--border)] bg-transparent opacity-55"
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={d.include}
                        onChange={(e) =>
                          updateDraft(d.key, { include: e.target.checked })
                        }
                        className="size-3.5 accent-[var(--accent)]"
                      />
                      Question {index + 1}
                    </label>
                    {d.confidence !== null && (
                      <Badge tone={d.confidence >= 0.75 ? "neutral" : "warning"}>
                        {Math.round(d.confidence * 100)}% classification confidence
                      </Badge>
                    )}
                    {problems.map((p) => (
                      <Badge key={p} tone="critical">
                        {p}
                      </Badge>
                    ))}
                    <button
                      onClick={() =>
                        setDrafts((prev) => prev.filter((x) => x.key !== d.key))
                      }
                      className="ml-auto text-[12.5px] text-[var(--text-muted)] hover:text-[var(--critical)]"
                    >
                      Remove
                    </button>
                  </div>

                  {d.passage && (
                    <p className="mb-2 line-clamp-3 rounded-md bg-[var(--surface-1)] p-2.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                      {d.passage}
                    </p>
                  )}

                  <textarea
                    value={d.question_text}
                    onChange={(e) =>
                      updateDraft(d.key, { question_text: e.target.value })
                    }
                    rows={2}
                    className={`${inputClass} mb-3 resize-y`}
                    placeholder="Question text"
                  />

                  {d.choices.length > 0 && (
                    <ul className="mb-3 flex flex-col gap-1">
                      {d.choices.map((c) => (
                        <li
                          key={c.label}
                          className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--text-secondary)]"
                        >
                          <span className="font-semibold text-[var(--text-primary)]">
                            {c.label}.
                          </span>
                          <span>{c.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                      <Field label="Skill">
                        <select
                          value={d.skill}
                          onChange={(e) =>
                            updateDraft(d.key, { skill: e.target.value })
                          }
                          className={inputClass}
                        >
                          <option value="">Select a skill...</option>
                          {taxonomy.map((entry) => (
                            <optgroup
                              key={entry.domain}
                              label={`${entry.section} › ${entry.domain}`}
                            >
                              {entry.skills.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="Your answer">
                      <input
                        value={d.student_answer}
                        onChange={(e) =>
                          updateDraft(d.key, { student_answer: e.target.value })
                        }
                        className={inputClass}
                        placeholder="B"
                      />
                    </Field>
                    <Field label="Correct answer">
                      <input
                        value={d.correct_answer}
                        onChange={(e) =>
                          updateDraft(d.key, { correct_answer: e.target.value })
                        }
                        className={inputClass}
                        placeholder="C"
                      />
                    </Field>
                  </div>

                  <div className="mt-3">
                    <Field
                      label="What were you thinking? (optional)"
                      hint="Your reasoning makes the diagnosis far more accurate."
                    >
                      <textarea
                        value={d.student_reasoning}
                        onChange={(e) =>
                          updateDraft(d.key, { student_reasoning: e.target.value })
                        }
                        rows={2}
                        className={`${inputClass} resize-y`}
                        placeholder="I picked B because it mentioned the experiment directly..."
                      />
                    </Field>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- sub-forms */

function ManualForm({
  taxonomy,
  onAdd,
}: {
  taxonomy: TaxonomyEntry[];
  onAdd: (d: DraftQuestion) => void;
}) {
  const [skill, setSkill] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [passage, setPassage] = useState("");
  const [choices, setChoices] = useState<Choice[]>(EMPTY_CHOICES);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [difficulty, setDifficulty] = useState<"" | "easy" | "medium" | "hard">("");
  const [classifying, setClassifying] = useState(false);
  const [classifyNote, setClassifyNote] = useState<string | null>(null);

  async function classify() {
    if (!questionText.trim()) return;
    setClassifying(true);
    setClassifyNote(null);
    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_text: questionText,
          passage: passage || null,
          choices: choices.filter((c) => c.text.trim()),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not classify");
      setSkill(data.skill);
      if (data.difficulty) setDifficulty(data.difficulty);
      setClassifyNote(`${data.reason} (${Math.round(data.confidence * 100)}% confident)`);
    } catch (e) {
      setClassifyNote(e instanceof Error ? e.message : "Could not classify");
    } finally {
      setClassifying(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const entry = taxonomy.find((t) => t.skills.includes(skill));
    onAdd({
      key: nextKey(),
      section: entry?.section ?? "",
      domain: entry?.domain ?? "",
      skill,
      difficulty,
      passage,
      question_text: questionText,
      choices: choices.filter((c) => c.text.trim()),
      student_answer: studentAnswer,
      correct_answer: correctAnswer,
      student_reasoning: reasoning,
      confidence: null,
      include: true,
    });

    setQuestionText("");
    setPassage("");
    setChoices(EMPTY_CHOICES);
    setStudentAnswer("");
    setCorrectAnswer("");
    setReasoning("");
    setClassifyNote(null);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Passage or setup (optional)">
        <textarea
          value={passage}
          onChange={(e) => setPassage(e.target.value)}
          rows={3}
          className={`${inputClass} resize-y`}
          placeholder="Paste the passage, or describe the figure or table."
        />
      </Field>

      <Field label="Question">
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          rows={2}
          required
          className={`${inputClass} resize-y`}
          placeholder="Which choice best states the main idea of the text?"
        />
      </Field>

      <div>
        <span className={labelClass}>Answer choices (optional but recommended)</span>
        <div className="flex flex-col gap-2">
          {choices.map((c, i) => (
            <div key={c.label} className="flex items-center gap-2">
              <span className="tnum grid size-8 shrink-0 place-items-center rounded-md bg-[var(--surface-2)] text-[12.5px] font-semibold text-[var(--text-secondary)]">
                {c.label}
              </span>
              <input
                value={c.text}
                onChange={(e) => {
                  const next = [...choices];
                  next[i] = { ...c, text: e.target.value };
                  setChoices(next);
                }}
                className={inputClass}
                placeholder={`Choice ${c.label}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your answer">
          <input
            value={studentAnswer}
            onChange={(e) => setStudentAnswer(e.target.value)}
            required
            className={inputClass}
            placeholder="B"
          />
        </Field>
        <Field label="Correct answer">
          <input
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            required
            className={inputClass}
            placeholder="C"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label="Skill">
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">Select a skill...</option>
            {taxonomy.map((entry) => (
              <optgroup
                key={entry.domain}
                label={`${entry.section} › ${entry.domain}`}
              >
                {entry.skills.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Difficulty (optional)">
          <select
            value={difficulty}
            onChange={(e) =>
              setDifficulty(e.target.value as "" | "easy" | "medium" | "hard")
            }
            className={inputClass}
          >
            <option value="">Unknown</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={classify}
          disabled={classifying || !questionText.trim()}
          className={buttonStyles.secondary}
        >
          {classifying && <span className="pulse size-1.5 rounded-full bg-current" aria-hidden />}
          {classifying ? "Classifying..." : "Classify with AI"}
        </button>
        <span className="text-[12px] text-[var(--text-muted)]">
          Not sure which skill it is? Let SATLens decide.
        </span>
      </div>

      {classifyNote && (
        <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          {classifyNote}
        </p>
      )}

      <Field
        label="What were you thinking? (optional)"
        hint="Your own reasoning is the single biggest accuracy boost for the diagnosis."
      >
        <textarea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          rows={2}
          className={`${inputClass} resize-y`}
          placeholder="I eliminated A and D, then picked B because it restated the second paragraph."
        />
      </Field>

      <div>
        <button type="submit" className={buttonStyles.primary}>
          Add to review list
        </button>
      </div>
    </form>
  );
}

function PasteForm({
  onExtract,
  busy,
}: {
  onExtract: (text: string) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Paste your questions or answer log"
        hint="Anything readable works: typed-up questions, a list of question numbers with your answers and the key, or notes from a review session."
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className={`${inputClass} resize-y font-mono text-[12.5px]`}
          placeholder={`Q12 (Reading): Which choice best states the main idea?
  A) ...  B) ...  C) ...  D) ...
  I answered B, correct was C.

Q13 (Math, linear equations): 3x + 7 = 22, solve for x.
  I answered 6, correct was 5.`}
        />
      </Field>
      <div>
        <button
          onClick={() => onExtract(text)}
          disabled={busy || !text.trim()}
          className={buttonStyles.primary}
        >
          Extract and classify
        </button>
      </div>
    </div>
  );
}

function PdfForm({
  onExtract,
  busy,
}: {
  onExtract: (file: File, answerKey: string) => void;
  busy: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [answerKey, setAnswerKey] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className={labelClass}>Practice test PDF</span>
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files?.[0];
            if (dropped?.type === "application/pdf") setFile(dropped);
          }}
          onDragOver={(e) => e.preventDefault()}
          className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-6 py-9 text-center transition-colors hover:border-[var(--accent)]"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 16V4" />
            <path d="m7 9 5-5 5 5" />
            <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
          <p className="mt-3 text-[13.5px] font-medium text-[var(--text-primary)]">
            {file ? file.name : "Drop a PDF here, or click to browse"}
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            {file
              ? `${(file.size / 1e6).toFixed(1)} MB`
              : "Up to 20 MB. Only your own legally obtained material."}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <Field
        label="Your answers / answer key (optional)"
        hint="Most practice PDFs do not record which answers you picked. Paste them here and SATLens will match them up."
      >
        <textarea
          value={answerKey}
          onChange={(e) => setAnswerKey(e.target.value)}
          rows={4}
          className={`${inputClass} resize-y font-mono text-[12.5px]`}
          placeholder={`1. I put A, key says A
2. I put C, key says B
3. I put D, key says D`}
        />
      </Field>

      <div>
        <button
          onClick={() => file && onExtract(file, answerKey)}
          disabled={busy || !file}
          className={buttonStyles.primary}
        >
          Extract and classify
        </button>
      </div>
    </div>
  );
}
