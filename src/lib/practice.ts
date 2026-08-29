import * as z from "zod/v4";
import { askStructured, TUTOR_SYSTEM } from "./ai";
import { demoEvaluation, demoPracticeItem } from "./demo";
import { getDb } from "./db";
import {
  getPattern,
  insertAttempts,
  markPracticeAnswered,
  savePracticeItem,
  recomputePatternStatuses,
} from "./repo";
import { domainForSkill, findSkill } from "./taxonomy";
import type { PracticeItem } from "./types";

/**
 * Targeted practice. Questions are generated ORIGINAL content aimed at the
 * student's specific failure mechanism -- never reproduced College Board
 * material -- so the retest actually tests the thing that broke.
 */

const GeneratedSchema = z.object({
  passage: z
    .string()
    .nullable()
    .describe(
      "Original passage or data description, if the skill requires one. Null for standalone math questions.",
    ),
  question_text: z.string(),
  choices: z.array(
    z.object({
      label: z.enum(["A", "B", "C", "D"]),
      text: z.string(),
    }),
  ),
  correct_answer: z.enum(["A", "B", "C", "D"]),
  rationales: z
    .array(
      z.object({
        label: z.enum(["A", "B", "C", "D"]),
        why: z
          .string()
          .describe(
            "For the correct choice: why it is right. For wrong choices: the specific reasoning error that leads there.",
          ),
      }),
    )
    .describe("Exactly one entry per choice."),
  teaching_point: z
    .string()
    .describe("The transferable takeaway this question is built to teach."),
  faster_approach: z
    .string()
    .nullable()
    .describe("A quicker route to the answer, if a meaningfully faster one exists."),
});

export interface GenerateOptions {
  skill: string;
  difficulty?: "easy" | "medium" | "hard";
  patternId?: string | null;
}

export async function generatePracticeItem(
  opts: GenerateOptions,
): Promise<PracticeItem> {
  const skillNode = findSkill(opts.skill);
  if (!skillNode) throw new Error(`Unknown skill: ${opts.skill}`);

  const domain = domainForSkill(skillNode.name);
  const difficulty = opts.difficulty ?? "medium";
  const pattern = opts.patternId ? getPattern(opts.patternId) : null;

  // Show the model what the student has actually gotten wrong here, so the new
  // question baits the same trap rather than being a random item on the topic.
  const priorMistakes = getDb()
    .prepare(
      `SELECT a.question_text, a.student_answer, a.correct_answer,
              d.mistake_type, d.headline, d.explanation, d.trap
         FROM attempts a JOIN diagnoses d ON d.attempt_id = a.id
        WHERE a.skill = ? AND a.is_correct = 0
        ORDER BY a.occurred_on DESC LIMIT 4`,
    )
    .all(skillNode.name) as {
    question_text: string;
    student_answer: string;
    correct_answer: string;
    mistake_type: string;
    headline: string;
    explanation: string;
    trap: string | null;
  }[];

  const mistakeContext = priorMistakes.length
    ? priorMistakes
        .map(
          (m) =>
            `- [${m.mistake_type}] ${m.headline}\n  Chose ${m.student_answer} over ${m.correct_answer}. ${m.explanation}${m.trap ? ` Trap: ${m.trap}` : ""}\n  Question was: ${m.question_text.slice(0, 220)}`,
        )
        .join("\n")
    : "No diagnosed mistakes on this skill yet -- write a clean representative question.";

  const patternContext = pattern
    ? `TARGET PATTERN TO RETEST: "${pattern.title}"
${pattern.description}

The question you write MUST create a genuine opportunity for this exact error. Include a distractor that a student with this habit would select. If the student has truly fixed the habit, they should get it right; if not, they should fall for the distractor.`
    : "";

  const generated = await askStructured({
    system: `${TUTOR_SYSTEM}

You write ORIGINAL SAT-style practice questions. Hard requirements:

- The question must be entirely your own writing. Never reproduce or lightly paraphrase a real College Board question, passage, or answer set.
- Match authentic Digital SAT format, tone, and difficulty calibration.
- Exactly four choices labeled A, B, C, D, with exactly one defensibly correct answer.
- Wrong choices must be engineered distractors, each traceable to a specific plausible reasoning error -- not filler.
- Write a rationale for every choice, including the correct one.

The question must test the SPECIFIC mechanism described below, not just the general topic. A question that a student could answer correctly while still holding the misconception is a failed question.`,
    messages: [
      {
        role: "user",
        content: `SECTION: ${domain?.section ?? "Reading and Writing"}
DOMAIN: ${domain?.name ?? "Unknown"}
SKILL: ${skillNode.name} -- ${skillNode.blurb}
DIFFICULTY: ${difficulty}

${patternContext}

WHAT THIS STUDENT HAS GOTTEN WRONG ON THIS SKILL:
${mistakeContext}`,
    },
    ],
    schema: GeneratedSchema,
    effort: "high",
    demo: () => demoPracticeItem(skillNode.name, difficulty),
  });

  const rationales: Record<string, string> = {};
  for (const r of generated.rationales) rationales[r.label] = r.why;

  const id = savePracticeItem({
    section: domain?.section ?? "Reading and Writing",
    domain: domain?.name ?? "Unknown",
    skill: skillNode.name,
    difficulty,
    pattern_id: pattern?.id ?? null,
    passage: generated.passage,
    question_text: generated.question_text,
    choices: generated.choices,
    correct_answer: generated.correct_answer,
    rationales,
    teaching_point: generated.teaching_point,
    faster_approach: generated.faster_approach,
  });

  return {
    id,
    created_at: new Date().toISOString(),
    section: domain?.section ?? "Reading and Writing",
    domain: domain?.name ?? "Unknown",
    skill: skillNode.name,
    difficulty,
    pattern_id: pattern?.id ?? null,
    passage: generated.passage,
    question_text: generated.question_text,
    choices: generated.choices,
    correct_answer: generated.correct_answer,
    rationales,
    teaching_point: generated.teaching_point,
    faster_approach: generated.faster_approach,
    answered: false,
  };
}

/* ------------------------------------------------------------- evaluation */

const EvaluationSchema = z.object({
  verdict: z
    .enum(["overcame", "partial", "repeated"])
    .describe(
      "overcame = answered correctly for the right reason; partial = right answer, shaky or lucky reasoning, or wrong answer for a new reason; repeated = the same old mechanism fired again.",
    ),
  feedback: z
    .string()
    .describe(
      "2-4 sentences addressed to the student about what their answer and reasoning show.",
    ),
  reasoning_assessment: z
    .string()
    .nullable()
    .describe(
      "Assessment of the student's stated reasoning, or null if they did not provide any.",
    ),
  next_step: z
    .string()
    .describe("The single most useful next action for this student."),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

export interface SubmitResult extends Evaluation {
  isCorrect: boolean;
  correctAnswer: string;
  rationales: Record<string, string>;
  teachingPoint: string;
  fasterApproach: string | null;
  attemptId: string;
}

export async function submitPracticeAnswer(params: {
  item: PracticeItem;
  answer: string;
  reasoning?: string | null;
  timeSpentSeconds?: number | null;
}): Promise<SubmitResult> {
  const { item, answer, reasoning, timeSpentSeconds } = params;
  const isCorrect =
    answer.trim().toLowerCase() === item.correct_answer.trim().toLowerCase();

  const pattern = item.pattern_id ? getPattern(item.pattern_id) : null;

  // Record the attempt first so it counts toward accuracy and pattern status
  // whether or not the evaluation call succeeds.
  const [attemptId] = insertAttempts([
    {
      occurred_on: new Date().toISOString().slice(0, 10),
      source: "practice",
      source_label: pattern ? `Retest: ${pattern.title}` : "Targeted practice",
      section: item.section,
      domain: item.domain,
      skill: item.skill,
      difficulty: item.difficulty,
      passage: item.passage,
      question_text: item.question_text,
      choices: item.choices,
      student_answer: answer,
      correct_answer: item.correct_answer,
      student_reasoning: reasoning ?? null,
      time_spent_seconds: timeSpentSeconds ?? null,
      practice_item_id: item.id,
      retest_pattern_id: item.pattern_id,
    },
  ]);

  markPracticeAnswered(item.id);
  recomputePatternStatuses();

  const evaluation = await askStructured({
    system: `${TUTOR_SYSTEM}

A student has just answered a practice question that was generated specifically to retest a known weakness. Judge whether the underlying habit has actually changed.

A correct answer with muddled or lucky reasoning is "partial", not "overcame". A wrong answer caused by a genuinely different error is "partial", not "repeated" -- "repeated" is reserved for the same mechanism firing again.`,
    messages: [
      {
        role: "user",
        content: `SKILL: ${item.skill}
${pattern ? `PATTERN BEING RETESTED: "${pattern.title}"\n${pattern.description}\n` : ""}
${item.passage ? `PASSAGE:\n${item.passage}\n` : ""}
QUESTION: ${item.question_text}

CHOICES:
${item.choices.map((c) => `${c.label}. ${c.text}`).join("\n")}

CORRECT ANSWER: ${item.correct_answer}
STUDENT ANSWERED: ${answer} (${isCorrect ? "correct" : "incorrect"})
STUDENT'S REASONING: ${reasoning?.trim() || "(not provided)"}

Why each choice is right or wrong:
${Object.entries(item.rationales)
  .map(([label, why]) => `${label}: ${why}`)
  .join("\n")}`,
      },
    ],
    schema: EvaluationSchema,
    effort: "high",
    demo: () =>
      demoEvaluation({
        isCorrect,
        reasoning: reasoning ?? null,
        skill: item.skill,
        patternTitle: pattern?.title ?? null,
      }),
  });

  return {
    ...evaluation,
    isCorrect,
    attemptId,
    correctAnswer: item.correct_answer,
    rationales: item.rationales,
    teachingPoint: item.teaching_point,
    fasterApproach: item.faster_approach,
  };
}
