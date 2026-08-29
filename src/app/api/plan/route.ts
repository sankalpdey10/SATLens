import { generateStudyPlan } from "@/lib/plan";
import { fail, ok } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    return ok(await generateStudyPlan());
  } catch (error) {
    return fail(error);
  }
}
