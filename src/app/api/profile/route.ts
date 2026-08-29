import { getProfile, saveProfile } from "@/lib/repo";
import { fail, ok } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(getProfile());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      test_date?: string | null;
      target_score?: number | null;
      current_score?: number | null;
      hours_per_week?: number | null;
    };
    saveProfile(body);
    return ok(getProfile());
  } catch (error) {
    return fail(error);
  }
}
