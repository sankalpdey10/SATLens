import * as z from "zod/v4";
import { askStructured, TUTOR_SYSTEM } from "./ai";
import { listPatterns, getProfile } from "./repo";
import {
  getAccuracyOverTime,
  getDomainStats,
  getOverview,
  getWeakestSkills,
} from "./stats";

/**
 * Personalized study plan. Re-generated on demand so it re-weights itself as
 * new practice data arrives -- a skill that improves gets less time next week.
 */

const PlanSchema = z.object({
  summary: z
    .string()
    .describe(
      "2-4 sentences: where the student stands, what the plan prioritizes, and why.",
    ),
  adjustment_note: z
    .string()
    .nullable()
    .describe(
      "What recent data changed about the priorities, e.g. a skill that improved and now gets less time. Null if there is not enough history to say.",
    ),
  allocations: z
    .array(
      z.object({
        skill: z.string(),
        domain: z.string(),
        share_of_time: z
          .number()
          .describe("Percent of weekly study time, 0-100. All allocations sum to 100."),
        rationale: z.string().describe("One sentence tied to their actual data."),
      }),
    )
    .describe("Ordered most to least time. At most 6 entries."),
  sessions: z
    .array(
      z.object({
        label: z.string().describe("e.g. 'Session 1' or 'Mon'"),
        focus: z.string().describe("The skill or pattern this session targets."),
        minutes: z.number(),
        activity: z
          .string()
          .describe("Concretely what to do, referencing SATLens features where useful."),
        success_check: z
          .string()
          .describe("How the student knows the session worked."),
      }),
    )
    .describe("One week of sessions that fit inside the available hours."),
  milestones: z.array(
    z.object({
      when: z.string().describe("A date or relative marker like 'in 2 weeks'."),
      target: z.string(),
    }),
  ),
});

export type StudyPlan = z.infer<typeof PlanSchema>;

export async function generateStudyPlan(): Promise<StudyPlan> {
  const profile = getProfile();
  const overview = getOverview();
  const weakest = getWeakestSkills(8);
  const domains = getDomainStats();
  const patterns = listPatterns();
  const trend = getAccuracyOverTime();

  const daysUntilTest = profile.test_date
    ? Math.ceil(
        (new Date(profile.test_date).getTime() - Date.now()) / 86_400_000,
      )
    : null;

  const trendText = trend.length
    ? trend
        .slice(-10)
        .map(
          (t) =>
            `${t.date}: ${Math.round(t.accuracy * 100)}% that day (${t.correct}/${t.total}), cumulative ${Math.round(t.cumulativeAccuracy * 100)}%`,
        )
        .join("\n")
    : "No practice history yet.";

  return askStructured({
    system: `${TUTOR_SYSTEM}

You are building a study schedule. Allocate time by expected point gain, not by how bad a score looks: a weak skill that appears often on the test is worth more than a slightly weaker skill that appears rarely. Weight active mistake patterns heavily -- those are known, diagnosed, fixable losses.

If a skill's recent data shows improvement, explicitly reduce its share and say so in adjustment_note. The plan must fit inside the student's stated available hours; do not prescribe more time than they have.`,
    messages: [
      {
        role: "user",
        content: `STUDENT PROFILE
Test date: ${profile.test_date ?? "not set"}${daysUntilTest !== null ? ` (${daysUntilTest} days away)` : ""}
Target score: ${profile.target_score ?? "not set"}
Current/most recent score: ${profile.current_score ?? "not set"}
Available study time: ${profile.hours_per_week ?? "not set"} hours per week

OVERALL
${overview.total} questions analyzed, ${Math.round((overview.accuracy ?? 0) * 100)}% accuracy across ${overview.daysActive} practice days.

DOMAIN ACCURACY
${domains.map((d) => `${d.section} > ${d.domain}: ${Math.round(d.accuracy * 100)}% (${d.correct}/${d.total})`).join("\n") || "No data."}

WEAKEST SKILLS (min 3 questions)
${weakest.map((s) => `${s.domain} > ${s.skill}: ${Math.round(s.accuracy * 100)}% (${s.correct}/${s.total})`).join("\n") || "Not enough data."}

DIAGNOSED MISTAKE PATTERNS
${
  patterns.length
    ? patterns
        .map(
          (p) =>
            `[${p.status}, ${p.severity} severity] ${p.title} (${p.domain}${p.skill ? ` > ${p.skill}` : ""})\n   ${p.description}`,
        )
        .join("\n")
    : "None detected yet."
}

RECENT TREND
${trendText}`,
      },
    ],
    schema: PlanSchema,
    effort: "high",
  });
}
