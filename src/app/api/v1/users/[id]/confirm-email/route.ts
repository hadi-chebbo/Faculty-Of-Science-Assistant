import { adminWrite, reply } from "@/lib/resources-api";
import { confirmUserEmail } from "@/services/users/users";

type Context = { params: Promise<{ id: string }> };

// Admin only: confirms the user's email by hand. Safe to repeat.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return adminWrite(request, async (viewer) => reply(await confirmUserEmail(viewer, id), 200));
}
