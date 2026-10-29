import { readJsonObject, reply } from "@/lib/resources-api";
import { signedIn } from "@/lib/saved-api";
import type { MoveCardInput } from "@/services/todos/schemas";
import { moveCard } from "@/services/todos/todos";

type Context = { params: Promise<{ id: string }> };

// Moves a card to a place in a column: `{ status, index }`, index 0 = top. 200 with `{ card, fileMarked, rewards, progress }`: the last three describe the
// linked file marked as done when the card entered Done (false / null otherwise).
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return signedIn(request, async (viewer) => {
    const body = (await readJsonObject(request)) ?? {};
    // The service validates the input; the cast only satisfies the compiler.
    return reply(await moveCard(viewer, id, body as MoveCardInput), 200);
  });
}
