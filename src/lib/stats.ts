import { getDb } from "./db";
import { DOMAINS, domainForSkill } from "./taxonomy";

/** Dashboard aggregates. All pure SQL -- no model calls, so the dashboard is instant. */

export interface Overview {
  total: number;
  correct: number;
  accuracy: number | null;
  incorrect: number;
  diagnosed: number;
  undiagnosed: number;
  patterns: number;
  activePatterns: number;
  resolvedPatterns: number;
  practiceAttempts: number;
  daysActive: number;
  firstDate: string | null;
  lastDate: string | null;
}

export function getOverview(): Overview {
  const db = getDb();
  const base = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(is_correct), 0) AS correct,
              COUNT(DISTINCT occurred_on) AS days,
              MIN(occurred_on) AS first, MAX(occurred_on) AS last,
              COALESCE(SUM(CASE WHEN source = 'practice' THEN 1 ELSE 0 END), 0) AS practice
         FROM attempts`,
    )
    .get() as {
    total: number;
    correct: number;
    days: number;
    first: string | null;
    last: string | null;
    practice: number;
  };

  const diagnosed = (
    db.prepare(`SELECT COUNT(*) AS n FROM diagnoses`).get() as { n: number }
  ).n;
  const undiagnosed = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM attempts WHERE is_correct = 0 AND analyzed = 0`,
      )
      .get() as { n: number }
  ).n;

  const patternCounts = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
              COALESCE(SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END), 0) AS resolved
         FROM patterns`,
    )
    .get() as { total: number; active: number; resolved: number };

  return {
    total: base.total,
    correct: base.correct,
    incorrect: base.total - base.correct,
    accuracy: base.total ? base.correct / base.total : null,
    diagnosed,
    undiagnosed,
    patterns: patternCounts.total,
    activePatterns: patternCounts.active,
    resolvedPatterns: patternCounts.resolved,
    practiceAttempts: base.practice,
    daysActive: base.days,
    firstDate: base.first,
    lastDate: base.last,
  };
}

export interface SectionStat {
  section: string;
  total: number;
  correct: number;
  accuracy: number;
}

export function getSectionStats(): SectionStat[] {
  return (
    getDb()
      .prepare(
        `SELECT section, COUNT(*) AS total, SUM(is_correct) AS correct
           FROM attempts GROUP BY section ORDER BY section`,
      )
      .all() as { section: string; total: number; correct: number }[]
  ).map((r) => ({ ...r, accuracy: r.correct / r.total }));
}

export interface DomainStat {
  domain: string;
  section: string;
  total: number;
  correct: number;
  accuracy: number;
  skills: SkillStat[];
}

export interface SkillStat {
  skill: string;
  slug: string;
  domain: string;
  section: string;
  total: number;
  correct: number;
  accuracy: number;
  /** Wrong attempts still awaiting diagnosis. */
  undiagnosed: number;
  patternCount: number;
}

export function getSkillStats(): SkillStat[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.skill, a.domain, a.section,
              COUNT(*) AS total,
              SUM(a.is_correct) AS correct,
              SUM(CASE WHEN a.is_correct = 0 AND a.analyzed = 0 THEN 1 ELSE 0 END) AS undiagnosed
         FROM attempts a
        GROUP BY a.skill, a.domain, a.section`,
    )
    .all() as {
    skill: string;
    domain: string;
    section: string;
    total: number;
    correct: number;
    undiagnosed: number;
  }[];

  const patternCounts = new Map(
    (
      db
        .prepare(
          `SELECT skill, COUNT(*) AS n FROM patterns WHERE skill IS NOT NULL GROUP BY skill`,
        )
        .all() as { skill: string; n: number }[]
    ).map((r) => [r.skill, r.n]),
  );

  return rows.map((r) => {
    const node = domainForSkill(r.skill);
    const slug =
      node?.skills.find((s) => s.name === r.skill)?.slug ??
      r.skill.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      ...r,
      slug,
      accuracy: r.correct / r.total,
      patternCount: patternCounts.get(r.skill) ?? 0,
    };
  });
}

export function getDomainStats(): DomainStat[] {
  const skills = getSkillStats();
  const out: DomainStat[] = [];

  for (const d of DOMAINS) {
    const mine = skills.filter((s) => s.domain === d.name);
    if (!mine.length) continue;
    const total = mine.reduce((n, s) => n + s.total, 0);
    const correct = mine.reduce((n, s) => n + s.correct, 0);
    out.push({
      domain: d.name,
      section: d.section,
      total,
      correct,
      accuracy: correct / total,
      skills: mine.sort((a, b) => a.accuracy - b.accuracy),
    });
  }

  return out.sort((a, b) => a.accuracy - b.accuracy);
}

/**
 * Strengths/weaknesses need a minimum sample or a single lucky question reads
 * as mastery. Below the threshold a skill is "not enough data", not a strength.
 */
export const MIN_SAMPLE = 3;

export function getWeakestSkills(limit = 5): SkillStat[] {
  return getSkillStats()
    .filter((s) => s.total >= MIN_SAMPLE)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
    .slice(0, limit);
}

export function getStrongestSkills(limit = 5): SkillStat[] {
  return getSkillStats()
    .filter((s) => s.total >= MIN_SAMPLE)
    .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total)
    .slice(0, limit);
}

export interface TimePoint {
  date: string;
  total: number;
  correct: number;
  accuracy: number;
  cumulativeAccuracy: number;
}

export function getAccuracyOverTime(skill?: string): TimePoint[] {
  const rows = getDb()
    .prepare(
      `SELECT occurred_on AS date, COUNT(*) AS total, SUM(is_correct) AS correct
         FROM attempts
        ${skill ? "WHERE skill = ?" : ""}
        GROUP BY occurred_on ORDER BY occurred_on ASC`,
    )
    .all(...(skill ? [skill] : [])) as {
    date: string;
    total: number;
    correct: number;
  }[];

  let runningTotal = 0;
  let runningCorrect = 0;
  return rows.map((r) => {
    runningTotal += r.total;
    runningCorrect += r.correct;
    return {
      date: r.date,
      total: r.total,
      correct: r.correct,
      accuracy: r.correct / r.total,
      cumulativeAccuracy: runningCorrect / runningTotal,
    };
  });
}

export interface MistakeTypeStat {
  mistake_type: string;
  count: number;
  share: number;
}

export function getMistakeBreakdown(skill?: string): MistakeTypeStat[] {
  const rows = getDb()
    .prepare(
      `SELECT d.mistake_type, COUNT(*) AS count
         FROM diagnoses d JOIN attempts a ON a.id = d.attempt_id
        ${skill ? "WHERE a.skill = ?" : ""}
        GROUP BY d.mistake_type ORDER BY count DESC`,
    )
    .all(...(skill ? [skill] : [])) as {
    mistake_type: string;
    count: number;
  }[];

  const total = rows.reduce((n, r) => n + r.count, 0);
  return rows.map((r) => ({ ...r, share: total ? r.count / total : 0 }));
}

export function getSkillStat(skill: string): SkillStat | null {
  return getSkillStats().find((s) => s.skill === skill) ?? null;
}

/** Distinct practice-test sources, for the import history view. */
export function getSources(): { label: string; total: number; correct: number }[] {
  return getDb()
    .prepare(
      `SELECT COALESCE(source_label, 'Unlabeled') AS label,
              COUNT(*) AS total, SUM(is_correct) AS correct
         FROM attempts GROUP BY label ORDER BY total DESC`,
    )
    .all() as { label: string; total: number; correct: number }[];
}
