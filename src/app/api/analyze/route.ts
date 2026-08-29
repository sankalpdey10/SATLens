import { diagnoseMany } from "@/lib/analysis";
import { getAttempt, listUndiagnosed } from "@/lib/repo";
import { fail, ok } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Diagnose one attempt (by id) or the backlog of undiagnosed wrong answers. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      attemptId?: string;
      limit?: number;
    };

    const attempts = body.attemptId
      ? [getAttempt(body.attemptId)].filter((a) => a !== null)
      : listUndiagnosed(Math.min(body.limit ?? 10, 25));

    if (!attempts.length) {
      return ok({ diagnosed: 0, errors: [], message: "Nothing to analyze." });
    }

    const result = await diagnoseMany(attempts);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
