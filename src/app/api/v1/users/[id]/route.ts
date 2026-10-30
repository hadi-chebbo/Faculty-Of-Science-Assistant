import { adminWrite, reply } from "@/lib/resources-api";
import { deleteUser } from "@/services/users/users";

type Context = { params: Promise<{ id: string }> };

// Admin only: deletes the account and everything that belongs to it (204). An admin account is refused (403).
export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return adminWrite(request, async (viewer) => {
    await deleteUser(viewer, id);
    return reply(null, 204);
  });
}
