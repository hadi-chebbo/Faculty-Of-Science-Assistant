import { adminWrite, reply } from "@/lib/resources-api";
import { unblockUser } from "@/services/users/users";

type Context = { params: Promise<{ id: string }> };

// Admin only: lets a blocked user sign in again. Safe to repeat.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return adminWrite(request, async (viewer) => reply(await unblockUser(viewer, id), 200));
}
