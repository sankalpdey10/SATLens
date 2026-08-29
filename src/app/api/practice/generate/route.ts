import { generatePracticeItem } from "@/lib/practice";
import { fail, ok } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      skill?: string;
      difficulty?: "easy" | "medium" | "hard";
      patternId?: string | null;
    };
    if (!body.skill) {
      return Response.json({ error: "A skill is required." }, { status: 400 });
    }
    return ok(
      await generatePracticeItem({
        skill: body.skill,
        difficulty: body.difficulty,
        patternId: body.patternId,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
