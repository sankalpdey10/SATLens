import { findFasterSolutions } from "@/lib/analysis";
import { fail, ok } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Faster-solution opportunities derived from the student's own missed questions. */
export async function POST(request: Request) {
  try {
    const { skill } = (await request.json().catch(() => ({}))) as {
      skill?: string;
    };
    return ok(await findFasterSolutions(skill));
  } catch (error) {
    return fail(error);
  }
}
