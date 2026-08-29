import { getDb, newId, nowIso } from "./db";
import {
  hydrateAttempt,
  hydratePracticeItem,
  type Attempt,
  type AttemptRow,
  type Diagnosis,
  type Pattern,
  type PatternWithEvidence,
  type PracticeItem,
  type PracticeItemRow,
  type Profile,
} from "./types";

/* ------------------------------------------------------------------ attempts */

export interface NewAttempt {
  occurred_on: string;
  source: "manual" | "pdf" | "practice";
  source_label?: string | null;
  section: string;
  domain: string;
  skill: string;
  difficulty?: "easy" | "medium" | "hard" | null;
  passage?: string | null;
  question_text: string;
  choices?: { label: string; text: string }[];
  student_answer: string;
  correct_answer: string;
  student_reasoning?: string | null;
  time_spent_seconds?: number | null;
  practice_item_id?: string | null;
  retest_pattern_id?: string | null;
}

export function insertAttempts(items: NewAttempt[]): string[] {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO attempts (
      id, created_at, occurred_on, source, source_label, section, domain, skill,
      difficulty, passage, question_text, choices, student_answer, correct_answer,
      is_correct, student_reasoning, time_spent_seconds, practice_item_id,
      retest_pattern_id, analyzed
    ) VALUES (
      @id, @created_at, @occurred_on, @source, @source_label, @section, @domain, @skill,
      @difficulty, @passage, @question_text, @choices, @student_answer, @correct_answer,
      @is_correct, @student_reasoning, @time_spent_seconds, @practice_item_id,
      @retest_pattern_id, 0
    )
  `);

  const ids: string[] = [];
  const insertAll = db.transaction((rows: NewAttempt[]) => {
    for (const row of rows) {
      const id = newId("att");
      ids.push(id);
      // Answer matching is case- and whitespace-insensitive so "b" == "B ".
      const isCorrect =
        row.student_answer.trim().toLowerCase() ===
        row.correct_answer.trim().toLowerCase();
      stmt.run({
        id,
        created_at: nowIso(),
        occurred_on: row.occurred_on,
        source: row.source,
        source_label: row.source_label ?? null,
        section: row.section,
        domain: row.domain,
        skill: row.skill,
        difficulty: row.difficulty ?? null,
        passage: row.passage ?? null,
        question_text: row.question_text,
        choices: row.choices ? JSON.stringify(row.choices) : null,
        student_answer: row.student_answer.trim(),
        correct_answer: row.correct_answer.trim(),
        is_correct: isCorrect ? 1 : 0,
        student_reasoning: row.student_reasoning ?? null,
        time_spent_seconds: row.time_spent_seconds ?? null,
        practice_item_id: row.practice_item_id ?? null,
        retest_pattern_id: row.retest_pattern_id ?? null,
      });
    }
  });

  insertAll(items);
  return ids;
}

export function getAttempt(id: string): Attempt | null {
  const row = getDb()
    .prepare(`SELECT * FROM attempts WHERE id = ?`)
    .get(id) as AttemptRow | undefined;
  return row ? hydrateAttempt(row) : null;
}

export interface AttemptFilter {
  skill?: string;
  domain?: string;
  section?: string;
  onlyIncorrect?: boolean;
  limit?: number;
}

export function listAttempts(filter: AttemptFilter = {}): Attempt[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.skill) {
    where.push("skill = @skill");
    params.skill = filter.skill;
  }
  if (filter.domain) {
    where.push("domain = @domain");
    params.domain = filter.domain;
  }
  if (filter.section) {
    where.push("section = @section");
    params.section = filter.section;
  }
  if (filter.onlyIncorrect) where.push("is_correct = 0");

  const sql = `
    SELECT * FROM attempts
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY occurred_on DESC, created_at DESC
    ${filter.limit ? `LIMIT ${Number(filter.limit)}` : ""}
  `;
  const rows = getDb().prepare(sql).all(params) as AttemptRow[];
  return rows.map(hydrateAttempt);
}

/** Wrong answers that have not been through AI diagnosis yet. */
export function listUndiagnosed(limit = 25): Attempt[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM attempts
       WHERE is_correct = 0 AND analyzed = 0
       ORDER BY occurred_on ASC, created_at ASC
       LIMIT ?`,
    )
    .all(limit) as AttemptRow[];
  return rows.map(hydrateAttempt);
}

export function countUndiagnosed(): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM attempts WHERE is_correct = 0 AND analyzed = 0`,
    )
    .get() as { n: number };
  return row.n;
}

export function deleteAttempt(id: string): void {
  getDb().prepare(`DELETE FROM attempts WHERE id = ?`).run(id);
}

/* ---------------------------------------------------------------- diagnoses */

export interface NewDiagnosis {
  attempt_id: string;
  mistake_type: string;
  headline: string;
  explanation: string;
  concept: string;
  faster_solution?: string | null;
  trap?: string | null;
  confidence: number;
}

export function saveDiagnosis(d: NewDiagnosis): void {
  const db = getDb();
  const write = db.transaction(() => {
    db.prepare(
      `INSERT INTO diagnoses (
         id, attempt_id, created_at, mistake_type, headline, explanation,
         concept, faster_solution, trap, confidence
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(attempt_id) DO UPDATE SET
         mistake_type = excluded.mistake_type,
         headline = excluded.headline,
         explanation = excluded.explanation,
         concept = excluded.concept,
         faster_solution = excluded.faster_solution,
         trap = excluded.trap,
         confidence = excluded.confidence,
         created_at = excluded.created_at`,
    ).run(
      newId("dx"),
      d.attempt_id,
      nowIso(),
      d.mistake_type,
      d.headline,
      d.explanation,
      d.concept,
      d.faster_solution ?? null,
      d.trap ?? null,
      d.confidence,
    );
    db.prepare(`UPDATE attempts SET analyzed = 1 WHERE id = ?`).run(d.attempt_id);
  });
  write();
}

export function getDiagnosis(attemptId: string): Diagnosis | null {
  return (
    (getDb()
      .prepare(`SELECT * FROM diagnoses WHERE attempt_id = ?`)
      .get(attemptId) as Diagnosis | undefined) ?? null
  );
}

/** Error-log rows: every incorrect attempt with its diagnosis, newest first. */
export interface ErrorLogEntry {
  attempt: Attempt;
  diagnosis: Diagnosis | null;
  /** How many earlier wrong attempts share this skill + mistake type. */
  priorOccurrences: number;
  patterns: { id: string; title: string }[];
}

export function getErrorLog(filter: AttemptFilter = {}): ErrorLogEntry[] {
  const db = getDb();
  const attempts = listAttempts({ ...filter, onlyIncorrect: true });

  const diagStmt = db.prepare(`SELECT * FROM diagnoses WHERE attempt_id = ?`);
  // Ordered by (date, insertion order). rowid rather than created_at because a
  // bulk import writes many rows inside one transaction and can stamp them all
  // with the same ISO timestamp, which would collapse the tie-break.
  const priorStmt = db.prepare(
    `SELECT COUNT(*) AS n
       FROM attempts a JOIN diagnoses d ON d.attempt_id = a.id
      WHERE a.skill = ? AND d.mistake_type = ?
        AND (a.occurred_on, a.rowid) <
            (SELECT occurred_on, rowid FROM attempts WHERE id = ?)`,
  );
  const patStmt = db.prepare(
    `SELECT p.id, p.title FROM patterns p
       JOIN pattern_evidence e ON e.pattern_id = p.id
      WHERE e.attempt_id = ?`,
  );

  return attempts.map((attempt) => {
    const diagnosis =
      (diagStmt.get(attempt.id) as Diagnosis | undefined) ?? null;
    const priorOccurrences = diagnosis
      ? (
          priorStmt.get(
            attempt.skill,
            diagnosis.mistake_type,
            attempt.id,
          ) as { n: number }
        ).n
      : 0;
    const patterns = patStmt.all(attempt.id) as { id: string; title: string }[];
    return { attempt, diagnosis, priorOccurrences, patterns };
  });
}

/* ----------------------------------------------------------------- patterns */

export interface NewPattern {
  title: string;
  description: string;
  recommendation: string;
  section: string;
  domain: string;
  skill?: string | null;
  mistake_type?: string | null;
  severity: "low" | "moderate" | "high";
  evidence: { attempt_id: string; note?: string | null }[];
}

/**
 * Pattern detection re-runs over the full history, so it replaces the previous
 * set wholesale rather than trying to diff. Detected-at timestamps are carried
 * over for patterns with the same title so "first seen" stays honest.
 */
export function replacePatterns(patterns: NewPattern[]): void {
  const db = getDb();
  const run = db.transaction(() => {
    const previous = db
      .prepare(`SELECT title, created_at, first_seen FROM patterns`)
      .all() as { title: string; created_at: string; first_seen: string }[];
    const priorByTitle = new Map(previous.map((p) => [p.title, p]));

    db.prepare(`DELETE FROM patterns`).run();

    const insertPattern = db.prepare(
      `INSERT INTO patterns (
         id, created_at, updated_at, title, description, recommendation,
         section, domain, skill, mistake_type, severity, status, first_seen, last_seen
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertEvidence = db.prepare(
      `INSERT OR IGNORE INTO pattern_evidence (pattern_id, attempt_id, note)
       VALUES (?, ?, ?)`,
    );
    const dateRange = db.prepare(
      `SELECT MIN(occurred_on) AS first, MAX(occurred_on) AS last
         FROM attempts WHERE id IN (SELECT value FROM json_each(?))`,
    );

    for (const p of patterns) {
      const id = newId("pat");
      const ids = p.evidence.map((e) => e.attempt_id);
      const range = dateRange.get(JSON.stringify(ids)) as {
        first: string | null;
        last: string | null;
      };
      const prior = priorByTitle.get(p.title);
      const now = nowIso();

      insertPattern.run(
        id,
        prior?.created_at ?? now,
        now,
        p.title,
        p.description,
        p.recommendation,
        p.section,
        p.domain,
        p.skill ?? null,
        p.mistake_type ?? null,
        p.severity,
        "active", // refined by recomputePatternStatus below
        prior?.first_seen ?? range.first ?? now.slice(0, 10),
        range.last ?? now.slice(0, 10),
      );

      for (const e of p.evidence) {
        insertEvidence.run(id, e.attempt_id, e.note ?? null);
      }
    }
  });
  run();
  recomputePatternStatuses();
}

/**
 * A pattern is "improving" or "resolved" based on what the student has done on
 * that skill SINCE the most recent piece of evidence -- this is what turns the
 * error log into a progress tracker rather than a list of regrets.
 */
export function recomputePatternStatuses(): void {
  const db = getDb();
  const patterns = db.prepare(`SELECT * FROM patterns`).all() as Pattern[];
  const update = db.prepare(`UPDATE patterns SET status = ? WHERE id = ?`);

  const run = db.transaction(() => {
    for (const p of patterns) {
      const since = db
        .prepare(
          `SELECT is_correct FROM attempts
            WHERE ${p.skill ? "skill = @key" : "domain = @key"}
              AND occurred_on >= @last
              AND id NOT IN (SELECT attempt_id FROM pattern_evidence WHERE pattern_id = @pid)
            ORDER BY occurred_on ASC, created_at ASC`,
        )
        .all({ key: p.skill ?? p.domain, last: p.last_seen, pid: p.id }) as {
        is_correct: number;
      }[];

      let status: Pattern["status"] = "active";
      if (since.length >= 2) {
        const correct = since.filter((a) => a.is_correct === 1).length;
        const rate = correct / since.length;
        const lastThree = since.slice(-3);
        const allRecentCorrect =
          lastThree.length >= 3 && lastThree.every((a) => a.is_correct === 1);

        if (allRecentCorrect && rate >= 0.8) status = "resolved";
        else if (rate >= 0.6) status = "improving";
      }
      update.run(status, p.id);
    }
  });
  run();
}

export function listPatterns(): Pattern[] {
  return getDb()
    .prepare(
      `SELECT * FROM patterns
        ORDER BY
          CASE status WHEN 'active' THEN 0 WHEN 'improving' THEN 1 ELSE 2 END,
          CASE severity WHEN 'high' THEN 0 WHEN 'moderate' THEN 1 ELSE 2 END,
          last_seen DESC`,
    )
    .all() as Pattern[];
}

export function getPattern(id: string): PatternWithEvidence | null {
  const db = getDb();
  const pattern = db
    .prepare(`SELECT * FROM patterns WHERE id = ?`)
    .get(id) as Pattern | undefined;
  if (!pattern) return null;

  const evidenceRows = db
    .prepare(
      `SELECT a.*, e.note AS evidence_note
         FROM pattern_evidence e JOIN attempts a ON a.id = e.attempt_id
        WHERE e.pattern_id = ?
        ORDER BY a.occurred_on ASC`,
    )
    .all(id) as (AttemptRow & { evidence_note: string | null })[];

  const evidence = evidenceRows.map((row) => {
    const { evidence_note, ...attemptRow } = row;
    return { attempt: hydrateAttempt(attemptRow), note: evidence_note };
  });

  const retestRows = db
    .prepare(
      `SELECT * FROM attempts
        WHERE ${pattern.skill ? "skill = @key" : "domain = @key"}
          AND occurred_on >= @last
          AND id NOT IN (SELECT attempt_id FROM pattern_evidence WHERE pattern_id = @pid)
        ORDER BY occurred_on ASC, created_at ASC`,
    )
    .all({
      key: pattern.skill ?? pattern.domain,
      last: pattern.last_seen,
      pid: id,
    }) as AttemptRow[];

  return { ...pattern, evidence, retests: retestRows.map(hydrateAttempt) };
}

export function patternsForSkill(skill: string): Pattern[] {
  return getDb()
    .prepare(`SELECT * FROM patterns WHERE skill = ? ORDER BY last_seen DESC`)
    .all(skill) as Pattern[];
}

/* ----------------------------------------------------------- practice items */

export interface NewPracticeItem {
  section: string;
  domain: string;
  skill: string;
  difficulty: "easy" | "medium" | "hard";
  pattern_id?: string | null;
  passage?: string | null;
  question_text: string;
  choices: { label: string; text: string }[];
  correct_answer: string;
  rationales: Record<string, string>;
  teaching_point: string;
  faster_approach?: string | null;
}

export function savePracticeItem(item: NewPracticeItem): string {
  const id = newId("pq");
  getDb()
    .prepare(
      `INSERT INTO practice_items (
         id, created_at, section, domain, skill, difficulty, pattern_id, passage,
         question_text, choices, correct_answer, rationales, teaching_point,
         faster_approach, answered
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      id,
      nowIso(),
      item.section,
      item.domain,
      item.skill,
      item.difficulty,
      item.pattern_id ?? null,
      item.passage ?? null,
      item.question_text,
      JSON.stringify(item.choices),
      item.correct_answer,
      JSON.stringify(item.rationales),
      item.teaching_point,
      item.faster_approach ?? null,
    );
  return id;
}

export function getPracticeItem(id: string): PracticeItem | null {
  const row = getDb()
    .prepare(`SELECT * FROM practice_items WHERE id = ?`)
    .get(id) as PracticeItemRow | undefined;
  return row ? hydratePracticeItem(row) : null;
}

export function markPracticeAnswered(id: string): void {
  getDb().prepare(`UPDATE practice_items SET answered = 1 WHERE id = ?`).run(id);
}

/* ------------------------------------------------------------------ profile */

export function getProfile(): Profile {
  const row = getDb()
    .prepare(`SELECT * FROM profile WHERE id = 1`)
    .get() as Profile | undefined;
  return (
    row ?? {
      test_date: null,
      target_score: null,
      current_score: null,
      hours_per_week: null,
      updated_at: null,
    }
  );
}

export function saveProfile(p: Partial<Profile>): void {
  const current = getProfile();
  getDb()
    .prepare(
      `INSERT INTO profile (id, test_date, target_score, current_score, hours_per_week, updated_at)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         test_date = excluded.test_date,
         target_score = excluded.target_score,
         current_score = excluded.current_score,
         hours_per_week = excluded.hours_per_week,
         updated_at = excluded.updated_at`,
    )
    .run(
      p.test_date ?? current.test_date,
      p.target_score ?? current.target_score,
      p.current_score ?? current.current_score,
      p.hours_per_week ?? current.hours_per_week,
      nowIso(),
    );
}
