import * as z from "zod/v4";
import Anthropic from "@anthropic-ai/sdk";
import { askStructured, TUTOR_SYSTEM } from "./ai";
import { DOMAINS, SECTIONS, findSkill } from "./taxonomy";
import { demoClassify, demoExtractText } from "./demo";

/**
 * Turns raw practice material (a pasted answer log, or a practice-test PDF)
 * into structured, taxonomy-classified question records. Extraction is always
 * reviewed by the student before anything is written to the database.
 */

/** The full taxonomy, rendered for the prompt so classification is constrained. */
const TAXONOMY_TEXT = DOMAINS.map(
  (d) =>
    `${d.section} > ${d.name}\n${d.skills.map((s) => `    - ${s.name}: ${s.blurb}`).join("\n")}`,
).join("\n\n");

const ExtractedSchema = z.object({
  questions: z.array(
    z.object({
      question_number: z
        .string()
        .nullable()
        .describe("Number or label from the source material, if present."),
      section: z.enum(SECTIONS),
      domain: z.string().describe("Must be exactly one of the domain names listed."),
      skill: z.string().describe("Must be exactly one of the skill names listed."),
      difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
      passage: z.string().nullable(),
      question_text: z.string(),
      choices: z.array(
        z.object({ label: z.string(), text: z.string() }),
      ),
      student_answer: z
        .string()
        .nullable()
        .describe("The answer the student selected, if determinable. Null if unknown."),
      correct_answer: z
        .string()
        .nullable()
        .describe("The correct answer, if determinable. Null if unknown."),
      student_reasoning: z.string().nullable(),
      classification_confidence: z
        .number()
        .describe("0-1 confidence in the section/domain/skill classification."),
    }),
  ),
  notes: z
    .string()
    .nullable()
    .describe("Anything the student should know about this extraction, e.g. missing answer keys."),
});

export type ExtractedQuestion = z.infer<
  typeof ExtractedSchema
>["questions"][number];

export interface ExtractionResult {
  questions: ExtractedQuestion[];
  notes: string | null;
}

const EXTRACTION_SYSTEM = `${TUTOR_SYSTEM}

You are extracting SAT practice questions from material a student supplied, and classifying each one against the official Digital SAT taxonomy.

TAXONOMY (use these names EXACTLY -- never invent a domain or skill):

${TAXONOMY_TEXT}

Rules:
- Classify by what the question actually ASKS the student to do, not by surface topic. A question about a science passage that asks which quotation supports a claim is "Command of Evidence (Textual)", not a science question.
- Copy question and answer text accurately from the source. Do not rewrite, summarize, or invent content.
- If the student's answer or the correct answer is not present in the material, set it to null rather than guessing. A guessed answer corrupts the whole analysis.
- Extract every question you can find. Do not stop early or sample.
- If the material contains no identifiable SAT questions, return an empty list and explain in notes.`;

/** Extract from free-form pasted text (answer logs, typed-up questions, notes). */
export async function extractFromText(text: string): Promise<ExtractionResult> {
  return askStructured({
    system: EXTRACTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract and classify every SAT question in the following material.\n\n---\n${text}\n---`,
      },
    ],
    schema: ExtractedSchema,
    effort: "medium",
    maxTokens: 16000,
    demo: () => demoExtractText(text),
  });
}

/**
 * Extract from a PDF. The document block is sent natively so Claude reads the
 * layout (tables, answer grids, figures), not just flattened text.
 */
export async function extractFromPdf(
  base64Pdf: string,
  answerKeyText?: string,
): Promise<ExtractionResult> {
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64Pdf,
      },
    },
    {
      type: "text",
      text: `Extract and classify every SAT question in this PDF.${
        answerKeyText
          ? `\n\nThe student also supplied this answer information -- use it to fill in student_answer and correct_answer:\n${answerKeyText}`
          : "\n\nIf the PDF contains no record of which answers the student chose, set student_answer to null for those questions."
      }`,
    },
  ];

  return askStructured({
    system: EXTRACTION_SYSTEM,
    messages: [{ role: "user", content }],
    schema: ExtractedSchema,
    effort: "medium",
    maxTokens: 16000,
    // A PDF cannot be parsed locally; say so rather than inventing questions.
    demo: () => ({
      questions: [],
      notes:
        "Demo mode cannot read PDFs -- that step needs the model. Use the 'Paste text' tab, or add an ANTHROPIC_API_KEY to enable PDF import.",
    }),
  });
}

/**
 * Classify a single manually-entered question. Used when the student knows the
 * question and their answer but not which skill it belongs to.
 */
const ClassifySchema = z.object({
  section: z.enum(SECTIONS),
  domain: z.string(),
  skill: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
  confidence: z.number(),
  reason: z.string().describe("One sentence on why this classification fits."),
});

export async function classifyQuestion(input: {
  question_text: string;
  passage?: string | null;
  choices?: { label: string; text: string }[];
}) {
  return askStructured({
    system: EXTRACTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Classify this single SAT question against the taxonomy.

${input.passage ? `PASSAGE:\n${input.passage}\n\n` : ""}QUESTION:
${input.question_text}
${
  input.choices?.length
    ? `\nCHOICES:\n${input.choices.map((c) => `${c.label}. ${c.text}`).join("\n")}`
    : ""
}`,
      },
    ],
    schema: ClassifySchema,
    effort: "low",
    maxTokens: 2000,
    demo: () => demoClassify(input),
  });
}

/**
 * Guard against the model drifting off the taxonomy. Anything unrecognized is
 * surfaced to the student for correction rather than silently stored.
 */
export function validateExtracted(q: ExtractedQuestion): {
  ok: boolean;
  problems: string[];
} {
  const problems: string[] = [];
  const skill = findSkill(q.skill);

  if (!skill) problems.push(`Unrecognized skill "${q.skill}"`);
  else if (skill.domain !== q.domain)
    problems.push(`Skill "${q.skill}" belongs to "${skill.domain}", not "${q.domain}"`);

  if (!q.student_answer) problems.push("Missing your answer");
  if (!q.correct_answer) problems.push("Missing the correct answer");

  return { ok: problems.length === 0, problems };
}
