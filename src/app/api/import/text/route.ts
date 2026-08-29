import { extractFromText } from "@/lib/importer";
import { fail, ok } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { text } = (await request.json()) as { text?: string };
    if (!text?.trim()) {
      return ok({ questions: [], notes: "Nothing to extract." });
    }
    return ok(await extractFromText(text));
  } catch (error) {
    return fail(error);
  }
}
