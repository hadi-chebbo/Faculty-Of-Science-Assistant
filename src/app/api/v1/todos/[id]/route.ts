import { readJsonObject, reply } from "@/lib/resources-api";
import { signedIn } from "@/lib/saved-api";
import type { UpdateCardInput } from "@/services/todos/schemas";
import { deleteCard, updateCard } from "@/services/todos/todos";

type Context = { params: Promise<{ id: string }> };

// Autosave from the card view: the title and/or the note. Anything that is not a JSON object is
// treated as an empty body, which changes nothing.
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  return signedIn(request, async (viewer) => {
    const body = (await readJsonObject(request)) ?? {};
    // The service validates the input; the cast only satisfies the compiler.
    return reply({ card: await updateCard(viewer, id, body as UpdateCardInput) }, 200);
  });
}

// Soft delete; the card can be brought back for a day.
export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  return signedIn(request, async (viewer) => {
    await deleteCard(viewer, id);
    return reply(null, 204);
  });
}
