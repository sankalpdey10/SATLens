import type { MistakeType } from "./taxonomy";

export interface Choice {
  label: string;
  text: string;
}

export type AttemptSource = "manual" | "pdf" | "practice";
export type Difficulty = "easy" | "medium" | "hard";
export type PatternStatus = "active" | "improving" | "resolved";
export type Severity = "low" | "moderate" | "high";

/** Raw row shape as stored in SQLite (JSON columns still strings). */
export interface AttemptRow {
  id: string;
  created_at: string;
  occurred_on: string;
  source: AttemptSource;
  source_label: string | null;
  section: string;
  domain: string;
  skill: string;
  difficulty: Difficulty | null;
  passage: string | null;
  question_text: string;
  choices: string | null;
  student_answer: string;
  correct_answer: string;
  is_correct: number;
  student_reasoning: string | null;
  time_spent_seconds: number | null;
  practice_item_id: string | null;
  retest_pattern_id: string | null;
  analyzed: number;
}

/** Hydrated attempt used everywhere above the data layer. */
export interface Attempt
  extends Omit<AttemptRow, "choices" | "is_correct" | "analyzed"> {
  choices: Choice[];
  isCorrect: boolean;
  analyzed: boolean;
}

export interface Diagnosis {
  id: string;
  attempt_id: string;
  created_at: string;
  mistake_type: MistakeType;
  headline: string;
  explanation: string;
  concept: string;
  faster_solution: string | null;
  trap: string | null;
  confidence: number;
}

export interface Pattern {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  recommendation: string;
  section: string;
  domain: string;
  skill: string | null;
  mistake_type: MistakeType | null;
  severity: Severity;
  confidence: number;
  status: PatternStatus;
  first_seen: string;
  last_seen: string;
}

export interface PatternWithEvidence extends Pattern {
  evidence: { attempt: Attempt; note: string | null }[];
  /** Attempts on this pattern's skill made after the pattern was detected. */
  retests: Attempt[];
}

export interface PracticeItemRow {
  id: string;
  created_at: string;
  section: string;
  domain: string;
  skill: string;
  difficulty: Difficulty;
  pattern_id: string | null;
  passage: string | null;
  question_text: string;
  choices: string;
  correct_answer: string;
  rationales: string;
  teaching_point: string;
  faster_approach: string | null;
  answered: number;
}

export interface PracticeItem
  extends Omit<PracticeItemRow, "choices" | "rationales" | "answered"> {
  choices: Choice[];
  rationales: Record<string, string>;
  answered: boolean;
}

export interface Profile {
  test_date: string | null;
  target_score: number | null;
  current_score: number | null;
  hours_per_week: number | null;
  updated_at: string | null;
}

export function hydrateAttempt(row: AttemptRow): Attempt {
  const { choices, is_correct, analyzed, ...rest } = row;
  return {
    ...rest,
    choices: choices ? (JSON.parse(choices) as Choice[]) : [],
    isCorrect: is_correct === 1,
    analyzed: analyzed === 1,
  };
}

export function hydratePracticeItem(row: PracticeItemRow): PracticeItem {
  const { choices, rationales, answered, ...rest } = row;
  return {
    ...rest,
    choices: JSON.parse(choices) as Choice[],
    rationales: JSON.parse(rationales) as Record<string, string>,
    answered: answered === 1,
  };
}
