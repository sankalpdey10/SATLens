import { detectPatterns } from "@/lib/patterns";
import { fail, ok } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    return ok(await detectPatterns());
  } catch (error) {
    return fail(error);
  }
}
