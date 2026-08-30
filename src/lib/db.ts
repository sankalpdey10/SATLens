import Database from "better-sqlite3";
import path from "node:path";

/**
 * SATLens stores everything locally in a single SQLite file. The whole product
 * is built on longitudinal history -- patterns only exist across many attempts
 * over time -- so persistence is not optional even for the MVP.
 */

let instance: Database.Database | null = null;

// Next.js dev mode re-evaluates modules on hot reload; cache on globalThis so we
// don't open a new handle (and re-run migrations) on every edit.
const globalForDb = globalThis as unknown as {
  __satlensDb?: Database.Database;
};

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- One row per question the student has answered, whether it came from an
-- imported practice test or from SATLens-generated targeted practice.
CREATE TABLE IF NOT EXISTS attempts (
  id                 TEXT PRIMARY KEY,
  created_at         TEXT NOT NULL,
  occurred_on        TEXT NOT NULL,           -- YYYY-MM-DD, backdatable on import
  source             TEXT NOT NULL,           -- manual | pdf | practice
  source_label       TEXT,                    -- e.g. "Practice Test 4"
  section            TEXT NOT NULL,
  domain             TEXT NOT NULL,
  skill              TEXT NOT NULL,
  difficulty         TEXT,                    -- easy | medium | hard
  passage            TEXT,
  question_text      TEXT NOT NULL,
  choices            TEXT,                    -- JSON: [{label, text}]
  student_answer     TEXT NOT NULL,
  correct_answer     TEXT NOT NULL,
  is_correct         INTEGER NOT NULL,
  student_reasoning  TEXT,
  time_spent_seconds INTEGER,
  practice_item_id   TEXT REFERENCES practice_items(id) ON DELETE SET NULL,
  retest_pattern_id  TEXT,                    -- pattern this attempt was meant to retest
  analyzed           INTEGER NOT NULL DEFAULT 0
);

-- AI diagnosis of a single wrong attempt. One per attempt.
CREATE TABLE IF NOT EXISTS diagnoses (
  id              TEXT PRIMARY KEY,
  attempt_id      TEXT NOT NULL UNIQUE REFERENCES attempts(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL,
  mistake_type    TEXT NOT NULL,
  headline        TEXT NOT NULL,   -- one-line "what went wrong"
  explanation     TEXT NOT NULL,   -- why the student's choice was tempting
  concept         TEXT NOT NULL,   -- the underlying rule to internalize
  faster_solution TEXT,            -- a quicker route, when one exists
  trap            TEXT,            -- the SAT trap being exploited, if any
  confidence      REAL NOT NULL DEFAULT 0.5
);

-- A recurring mistake pattern detected across MULTIPLE attempts. This is the
-- core of the product: not "you're bad at X" but "within X, you keep doing Y".
CREATE TABLE IF NOT EXISTS patterns (
  id             TEXT PRIMARY KEY,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  section        TEXT NOT NULL,
  domain         TEXT NOT NULL,
  skill          TEXT,             -- null when the pattern spans a whole domain
  mistake_type   TEXT,
  severity       TEXT NOT NULL DEFAULT 'moderate',  -- low | moderate | high
  confidence     REAL NOT NULL DEFAULT 0.7,         -- how well the evidence supports the pattern
  status         TEXT NOT NULL DEFAULT 'active',    -- active | improving | resolved
  first_seen     TEXT NOT NULL,
  last_seen      TEXT NOT NULL
);

-- Which specific past questions justify a pattern. Drives the "show me exactly
-- which questions caused this" view.
CREATE TABLE IF NOT EXISTS pattern_evidence (
  pattern_id TEXT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  note       TEXT,
  PRIMARY KEY (pattern_id, attempt_id)
);

-- AI-generated practice questions. Original content targeting one skill, so no
-- copyrighted College Board material is ever stored or redistributed.
CREATE TABLE IF NOT EXISTS practice_items (
  id             TEXT PRIMARY KEY,
  created_at     TEXT NOT NULL,
  section        TEXT NOT NULL,
  domain         TEXT NOT NULL,
  skill          TEXT NOT NULL,
  difficulty     TEXT NOT NULL,
  pattern_id     TEXT REFERENCES patterns(id) ON DELETE SET NULL,
  passage        TEXT,
  question_text  TEXT NOT NULL,
  choices        TEXT NOT NULL,   -- JSON: [{label, text}]
  correct_answer TEXT NOT NULL,
  rationales     TEXT NOT NULL,   -- JSON: {label: why right/wrong}
  teaching_point TEXT NOT NULL,
  faster_approach TEXT,
  answered       INTEGER NOT NULL DEFAULT 0
);

-- Single-row study profile.
CREATE TABLE IF NOT EXISTS profile (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  test_date       TEXT,
  target_score    INTEGER,
  current_score   INTEGER,
  hours_per_week  INTEGER,
  updated_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_attempts_skill      ON attempts(skill);
CREATE INDEX IF NOT EXISTS idx_attempts_domain     ON attempts(domain);
CREATE INDEX IF NOT EXISTS idx_attempts_date       ON attempts(occurred_on);
CREATE INDEX IF NOT EXISTS idx_attempts_analyzed   ON attempts(analyzed, is_correct);
CREATE INDEX IF NOT EXISTS idx_evidence_attempt    ON pattern_evidence(attempt_id);
CREATE INDEX IF NOT EXISTS idx_patterns_skill      ON patterns(skill);
`;

/**
 * Additive column migrations. SQLite's CREATE TABLE IF NOT EXISTS will not add
 * a column to a table that already exists, so a database created by an earlier
 * version needs them applied explicitly.
 */
const COLUMN_MIGRATIONS: { table: string; column: string; ddl: string }[] = [
  {
    table: "patterns",
    column: "confidence",
    ddl: "ALTER TABLE patterns ADD COLUMN confidence REAL NOT NULL DEFAULT 0.7",
  },
];

function migrate(db: Database.Database): void {
  for (const { table, column, ddl } of COLUMN_MIGRATIONS) {
    const columns = db
      .prepare(`PRAGMA table_info(${table})`)
      .all() as { name: string }[];
    if (!columns.some((c) => c.name === column)) db.exec(ddl);
  }
}

export function getDb(): Database.Database {
  if (globalForDb.__satlensDb) return globalForDb.__satlensDb;
  if (instance) return instance;

  const file =
    process.env.SATLENS_DB_PATH ?? path.join(process.cwd(), "satlens.db");
  const db = new Database(file);
  db.exec(SCHEMA);
  migrate(db);

  instance = db;
  globalForDb.__satlensDb = db;
  return db;
}

/** Short, URL-safe, sortable-ish id. */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
