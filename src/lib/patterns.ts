import * as z from "zod/v4";
import { askStructured, TUTOR_SYSTEM } from "./ai";
import { demoPatterns } from "./demo";
import { getDb } from "./db";
import { replacePatterns, type NewPattern } from "./repo";
import { MISTAKE_TYPES, SECTIONS } from "./taxonomy";

/**
 * Recurring-pattern detection. This is the feature that separates SATLens from
 * a score report: it looks across the whole history for the same *mechanism*
 * recurring, and cites the specific questions that prove it.
 */

const PatternSchema = z.object({
  patterns: z.array(
    z.object({
      title: z
        .string()
        .describe(
          "Specific, sub-skill level. Good: 'Picks detail-supported answers over passage-level main ideas'. Bad: 'Struggles with Information and Ideas'.",
        ),
      description: z
        .string()
        .describe(
          "3-5 sentences describing the recurring mechanism, what triggers it, and how it shows up in the cited questions.",
        ),
      recommendation: z
        .string()
        .describe(
          "One concrete, actionable habit change the student can apply on the next question.",
        ),
      section: z.enum(SECTIONS),
      domain: z.string(),
      skill: z
        .string()
        .nullable()
        .describe("The specific skill, or null if the pattern spans a whole domain."),
      mistake_type: z.enum(MISTAKE_TYPES).nullable(),
      severity: z.enum(["low", "moderate", "high"]),
      confidence: z
        .number()
        .describe(
          "0-1. How strongly the cited evidence supports this being a real recurring pattern rather than coincidence.",
        ),
      evidence: z.array(
        z.object({
          attempt_id: z
            .string()
            .describe("Must be an attempt ID copied exactly from the provided history."),
          note: z
            .string()
            .describe("One line on how this specific question exhibits the pattern."),
        }),
      ),
    }),
  ),
});

export interface DetectionResult {
  detected: number;
  discarded: number;
  analyzed: number;
}

export async function detectPatterns(): Promise<DetectionResult> {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT a.id, a.occurred_on, a.section, a.domain, a.skill, a.difficulty,
              a.question_text, a.choices, a.student_answer, a.correct_answer,
              a.student_reasoning, a.source_label,
              d.mistake_type, d.headline, d.explanation, d.concept, d.trap
         FROM attempts a
         JOIN diagnoses d ON d.attempt_id = a.id
        WHERE a.is_correct = 0
        ORDER BY a.occurred_on ASC`,
    )
    .all() as {
    id: string;
    occurred_on: string;
    section: string;
    domain: string;
    skill: string;
    difficulty: string | null;
    question_text: string;
    choices: string | null;
    student_answer: string;
    correct_answer: string;
    student_reasoning: string | null;
    source_label: string | null;
    mistake_type: string;
    headline: string;
    explanation: string;
    concept: string;
    trap: string | null;
  }[];

  // Below this there is no "recurring" to speak of -- one wrong answer is noise.
  if (rows.length < 3) {
    return { detected: 0, discarded: 0, analyzed: rows.length };
  }

  const validIds = new Set(rows.map((r) => r.id));

  const history = rows
    .map((r) => {
      const choices = r.choices
        ? (JSON.parse(r.choices) as { label: string; text: string }[])
        : [];
      const chosen = choices.find(
        (c) => c.label.toLowerCase() === r.student_answer.toLowerCase(),
      );
      const correct = choices.find(
        (c) => c.label.toLowerCase() === r.correct_answer.toLowerCase(),
      );
      return `ATTEMPT_ID: ${r.id}
Date: ${r.occurred_on}${r.source_label ? ` | Source: ${r.source_label}` : ""}
${r.section} > ${r.domain} > ${r.skill}${r.difficulty ? ` (${r.difficulty})` : ""}
Question: ${r.question_text.slice(0, 400)}
Chose ${r.student_answer}${chosen ? `: "${chosen.text.slice(0, 160)}"` : ""}
Correct ${r.correct_answer}${correct ? `: "${correct.text.slice(0, 160)}"` : ""}
${r.student_reasoning ? `Student's reasoning: ${r.student_reasoning}\n` : ""}Diagnosis: [${r.mistake_type}] ${r.headline}
  ${r.explanation}${r.trap ? `\n  Trap: ${r.trap}` : ""}`;
    })
    .join("\n\n---\n\n");

  // Accuracy context lets the model weigh a pattern against how often the
  // student actually gets that skill right.
  const skillStats = db
    .prepare(
      `SELECT skill, domain,
              COUNT(*) AS total,
              SUM(is_correct) AS correct
         FROM attempts GROUP BY skill, domain HAVING total > 0`,
    )
    .all() as { skill: string; domain: string; total: number; correct: number }[];

  const statsText = skillStats
    .map(
      (s) =>
        `${s.domain} > ${s.skill}: ${s.correct}/${s.total} correct (${Math.round((s.correct / s.total) * 100)}%)`,
    )
    .join("\n");

  const result = await askStructured({
    system: `${TUTOR_SYSTEM}

You are looking across a student's ENTIRE diagnosed mistake history to find recurring patterns.

A pattern is only a pattern if the SAME underlying mechanism appears in at least TWO different questions. One-off errors are not patterns -- omit them.

The critical distinction:
  WRONG: "You are weak in Information and Ideas."  (a score report can say that)
  RIGHT: "Within Information and Ideas, you consistently choose answers supported by one specific detail rather than the passage's central claim."

Every pattern must name a MECHANISM -- the specific reasoning move that goes wrong -- and must be narrower than the skill it belongs to.

Rules:
- Cite evidence with ATTEMPT_ID values copied exactly from the history. Never invent an ID.
- Every pattern needs at least 2 evidence attempts. Prefer 3+.
- Return at most 6 patterns. Fewer, sharper patterns beat many vague ones.
- Set severity by how many points it is plausibly costing: high = recurring in a high-frequency skill, low = occasional or in a rare skill.
- Do not create one pattern per mistake_type just to cover the taxonomy. Merge mechanisms that are really the same habit; split ones that only look similar.`,
    messages: [
      {
        role: "user",
        content: `SKILL-LEVEL ACCURACY:
${statsText}

FULL DIAGNOSED MISTAKE HISTORY (${rows.length} incorrect questions):

${history}`,
      },
    ],
    schema: PatternSchema,
    effort: "max", // this is the hardest reasoning task in the product
    maxTokens: 16000,
    demo: () =>
      demoPatterns(
        rows.map((r) => ({
          id: r.id,
          skill: r.skill,
          domain: r.domain,
          section: r.section,
          mistake_type: r.mistake_type,
          headline: r.headline,
          occurred_on: r.occurred_on,
        })),
      ),
  });

  // Drop hallucinated IDs, then drop patterns that no longer clear the
  // two-occurrence bar once invalid evidence is removed.
  let discarded = 0;
  const cleaned: NewPattern[] = [];

  for (const p of result.patterns) {
    const evidence = p.evidence.filter((e) => validIds.has(e.attempt_id));
    if (evidence.length < 2) {
      discarded += 1;
      continue;
    }
    cleaned.push({
      title: p.title,
      description: p.description,
      recommendation: p.recommendation,
      section: p.section,
      domain: p.domain,
      skill: p.skill,
      mistake_type: p.mistake_type,
      severity: p.severity,
      confidence: p.confidence,
      evidence: evidence.map((e) => ({ attempt_id: e.attempt_id, note: e.note })),
    });
  }

  replacePatterns(cleaned);

  return { detected: cleaned.length, discarded, analyzed: rows.length };
}
