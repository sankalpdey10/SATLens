import * as z from "zod/v4";
import { askStructured, TUTOR_SYSTEM } from "./ai";
import { MISTAKE_DESCRIPTIONS, MISTAKE_TYPES } from "./taxonomy";
import { getDb } from "./db";
import { listAttempts, saveDiagnosis } from "./repo";
import type { Attempt } from "./types";

const DiagnosisSchema = z.object({
  mistake_type: z.enum(MISTAKE_TYPES),
  headline: z
    .string()
    .describe(
      "One sentence, max 15 words, naming the specific error mechanism. Not 'you made a mistake'.",
    ),
  explanation: z
    .string()
    .describe(
      "2-4 sentences explaining why the student's specific choice was tempting and where the reasoning broke down. Reference the actual content of their answer.",
    ),
  concept: z
    .string()
    .describe(
      "The transferable rule or idea to internalize so this does not recur. 1-3 sentences.",
    ),
  faster_solution: z
    .string()
    .nullable()
    .describe(
      "A materially quicker route to the answer (elimination, Desmos, a formula, a structural shortcut). Null if the direct approach is already optimal.",
    ),
  trap: z
    .string()
    .nullable()
    .describe(
      "The SAT trap the wrong choice was engineered to exploit. Null if the wrong answer was not a designed distractor.",
    ),
  confidence: z
    .number()
    .describe("0-1 confidence in this diagnosis given the evidence available."),
});

export type DiagnosisResult = z.infer<typeof DiagnosisSchema>;

const MISTAKE_VOCAB = MISTAKE_TYPES.map(
  (t) => `- ${t}: ${MISTAKE_DESCRIPTIONS[t]}`,
).join("\n");

function describeAttempt(a: Attempt): string {
  const parts = [
    a.passage ? `PASSAGE:\n${a.passage}` : null,
    `QUESTION:\n${a.question_text}`,
    a.choices.length
      ? `CHOICES:\n${a.choices.map((c) => `${c.label}. ${c.text}`).join("\n")}`
      : null,
    `STUDENT ANSWERED: ${a.student_answer}`,
    `CORRECT ANSWER: ${a.correct_answer}`,
    a.student_reasoning
      ? `STUDENT'S OWN REASONING: ${a.student_reasoning}`
      : "STUDENT'S OWN REASONING: (not provided)",
    a.time_spent_seconds ? `TIME SPENT: ${a.time_spent_seconds}s` : null,
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** Prior wrong answers on the same skill, so the diagnosis can situate itself in history. */
function priorMistakeContext(attempt: Attempt): string {
  const rows = getDb()
    .prepare(
      `SELECT a.question_text, a.student_answer, a.correct_answer, a.occurred_on,
              d.mistake_type, d.headline
         FROM attempts a JOIN diagnoses d ON d.attempt_id = a.id
        WHERE a.skill = ? AND a.id != ? AND a.occurred_on <= ?
        ORDER BY a.occurred_on DESC
        LIMIT 6`,
    )
    .all(attempt.skill, attempt.id, attempt.occurred_on) as {
    question_text: string;
    student_answer: string;
    correct_answer: string;
    occurred_on: string;
    mistake_type: string;
    headline: string;
  }[];

  if (!rows.length) return "No previously diagnosed mistakes on this skill.";

  return rows
    .map(
      (r) =>
        `- ${r.occurred_on} [${r.mistake_type}] ${r.headline}\n  (answered ${r.student_answer}, correct was ${r.correct_answer}) ${r.question_text.slice(0, 140)}`,
    )
    .join("\n");
}

/**
 * Diagnose a single incorrect attempt and persist the result.
 * Correct attempts are skipped -- there is nothing to explain.
 */
export async function diagnoseAttempt(attempt: Attempt): Promise<DiagnosisResult> {
  const result = await askStructured({
    system: `${TUTOR_SYSTEM}

You are diagnosing one incorrect SAT question. Classify the mistake into exactly one of these types:

${MISTAKE_VOCAB}

Choose the type that describes the ROOT cause. If a student misread the stem and therefore computed the wrong thing, that is misreading, not calculation_error. If they knew the method but slipped in arithmetic, that is calculation_error, not conceptual_misunderstanding.

You are also shown the student's previously diagnosed mistakes on this same skill. Use them: if this error is the same mechanism recurring, say so explicitly in the explanation and describe the habit, not just this instance.`,
    messages: [
      {
        role: "user",
        content: `SECTION: ${attempt.section}
DOMAIN: ${attempt.domain}
SKILL: ${attempt.skill}
DATE: ${attempt.occurred_on}

${describeAttempt(attempt)}

--- STUDENT'S PRIOR DIAGNOSED MISTAKES ON "${attempt.skill}" ---
${priorMistakeContext(attempt)}`,
      },
    ],
    schema: DiagnosisSchema,
    effort: "high",
  });

  saveDiagnosis({
    attempt_id: attempt.id,
    mistake_type: result.mistake_type,
    headline: result.headline,
    explanation: result.explanation,
    concept: result.concept,
    faster_solution: result.faster_solution,
    trap: result.trap,
    confidence: result.confidence,
  });

  return result;
}

/** Diagnose a batch sequentially so prior-mistake context stays chronological. */
export async function diagnoseMany(
  attempts: Attempt[],
): Promise<{ diagnosed: number; errors: { id: string; message: string }[] }> {
  const errors: { id: string; message: string }[] = [];
  let diagnosed = 0;

  for (const attempt of attempts) {
    if (attempt.isCorrect) continue;
    try {
      await diagnoseAttempt(attempt);
      diagnosed += 1;
    } catch (error) {
      errors.push({
        id: attempt.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { diagnosed, errors };
}

/* ------------------------------------------------- cross-question insights */

const FasterSolutionSchema = z.object({
  insights: z.array(
    z.object({
      title: z.string().describe("Short name for the efficiency opportunity."),
      description: z
        .string()
        .describe(
          "What the student is doing the slow way and what to do instead. Reference their actual questions.",
        ),
      applies_to_skill: z.string(),
      example_attempt_ids: z.array(z.string()),
    }),
  ),
});

/**
 * Efficiency opportunities derived from the student's own missed questions --
 * not a generic list of SAT tricks.
 */
export async function findFasterSolutions(skill?: string) {
  const attempts = listAttempts({ skill, onlyIncorrect: true, limit: 40 });
  if (attempts.length < 3) return { insights: [] };

  const db = getDb();
  const withDiagnoses = attempts.map((a) => {
    const d = db
      .prepare(
        `SELECT mistake_type, headline, faster_solution FROM diagnoses WHERE attempt_id = ?`,
      )
      .get(a.id) as
      | { mistake_type: string; headline: string; faster_solution: string | null }
      | undefined;
    return `ID: ${a.id} | ${a.skill} | ${a.occurred_on}
Q: ${a.question_text.slice(0, 300)}
Answered ${a.student_answer}, correct ${a.correct_answer}${a.time_spent_seconds ? `, took ${a.time_spent_seconds}s` : ""}
${d ? `Diagnosis: [${d.mistake_type}] ${d.headline}${d.faster_solution ? ` | Noted shortcut: ${d.faster_solution}` : ""}` : "Not yet diagnosed"}`;
  });

  return askStructured({
    system: `${TUTOR_SYSTEM}

Identify where THIS student specifically is leaving time or accuracy on the table by using slower or more error-prone approaches than necessary. Ground every insight in the questions provided -- cite their attempt IDs. Do not produce generic SAT advice that would apply to any student. If there is no strong evidence for an efficiency insight, return fewer insights or none.`,
    messages: [
      {
        role: "user",
        content: `Here are the student's missed questions${skill ? ` for the skill "${skill}"` : ""}:\n\n${withDiagnoses.join("\n\n")}`,
      },
    ],
    schema: FasterSolutionSchema,
    effort: "high",
  });
}
