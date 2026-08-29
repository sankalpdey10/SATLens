import { classifyQuestion } from "@/lib/importer";
import { fail, ok } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question_text?: string;
      passage?: string | null;
      choices?: { label: string; text: string }[];
    };
    if (!body.question_text?.trim()) {
      return Response.json(
        { error: "Enter the question text first." },
        { status: 400 },
      );
    }
    return ok(await classifyQuestion({ ...body, question_text: body.question_text }));
  } catch (error) {
    return fail(error);
  }
}
