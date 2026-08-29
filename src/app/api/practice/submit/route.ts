import { submitPracticeAnswer } from "@/lib/practice";
import { getPracticeItem } from "@/lib/repo";
import { fail, ok } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      itemId?: string;
      answer?: string;
      reasoning?: string;
      timeSpentSeconds?: number;
    };

    if (!body.itemId || !body.answer) {
      return Response.json(
        { error: "An item and an answer are required." },
        { status: 400 },
      );
    }

    const item = getPracticeItem(body.itemId);
    if (!item) {
      return Response.json({ error: "Practice item not found." }, { status: 404 });
    }

    return ok(
      await submitPracticeAnswer({
        item,
        answer: body.answer,
        reasoning: body.reasoning,
        timeSpentSeconds: body.timeSpentSeconds,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
