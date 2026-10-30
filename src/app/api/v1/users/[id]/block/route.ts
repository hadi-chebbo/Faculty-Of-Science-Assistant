import { adminWrite, reply } from "@/lib/resources-api";
import { blockUser } from "@/services/users/users";

type Context = { params: Promise<{ id: string }> };

// Admin only: blocks the user and signs them out everywhere. Safe to repeat; an admin account is refused (403).
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return adminWrite(request, async (viewer) => reply(await blockUser(viewer, id), 200));
}
