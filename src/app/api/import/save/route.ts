import {
  insertAttempts,
  recomputePatternStatuses,
  type NewAttempt,
} from "@/lib/repo";
import { fail, ok } from "@/lib/route-helpers";
import { findSkill } from "@/lib/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { questions } = (await request.json()) as { questions: NewAttempt[] };

    if (!Array.isArray(questions) || !questions.length) {
      return Response.json({ error: "No questions to save." }, { status: 400 });
    }

    // Normalize against the taxonomy so a typo can never create a phantom skill.
    const normalized: NewAttempt[] = [];
    for (const q of questions) {
      const skill = findSkill(q.skill);
      if (!skill) {
        return Response.json(
          { error: `Unknown skill: "${q.skill}"` },
          { status: 400 },
        );
      }
      if (!q.student_answer?.trim() || !q.correct_answer?.trim()) {
        return Response.json(
          { error: `Question "${q.question_text.slice(0, 40)}..." is missing an answer.` },
          { status: 400 },
        );
      }
      normalized.push({
        ...q,
        section: skill.section,
        domain: skill.domain,
        skill: skill.name,
      });
    }

    const ids = insertAttempts(normalized);

    // Newly imported questions on a pattern's skill are evidence about whether
    // it is resolving, so statuses must not go stale after an import.
    recomputePatternStatuses();

    return ok({ saved: ids.length, ids });
  } catch (error) {
    return fail(error);
  }
}
