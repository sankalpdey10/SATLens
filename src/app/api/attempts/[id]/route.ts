import { deleteAttempt } from "@/lib/repo";
import { fail, ok } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    deleteAttempt(id);
    return ok({ deleted: id });
  } catch (error) {
    return fail(error);
  }
}
