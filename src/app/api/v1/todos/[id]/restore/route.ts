import { reply } from "@/lib/resources-api";
import { signedIn } from "@/lib/saved-api";
import { restoreCard } from "@/services/todos/todos";

type Context = { params: Promise<{ id: string }> };

// Undo of a delete: 200 with the card back in its old column and place, 409 `board_full` at 500.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return signedIn(request, async (viewer) => reply({ card: await restoreCard(viewer, id) }, 200));
}
