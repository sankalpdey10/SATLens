import { extractFromPdf } from "@/lib/importer";
import { fail, ok } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024; // the API caps a request at 32MB total

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const answerKey = form.get("answerKey");

    if (!(file instanceof File)) {
      return Response.json({ error: "No PDF uploaded." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return Response.json(
        { error: "That file is not a PDF." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return Response.json(
        { error: `PDF is ${(file.size / 1e6).toFixed(1)}MB; the limit is 20MB.` },
        { status: 400 },
      );
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await extractFromPdf(
      base64,
      typeof answerKey === "string" && answerKey.trim() ? answerKey : undefined,
    );
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
