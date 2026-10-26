import { readJsonObject, reply } from "@/lib/resources-api";
import { signedIn } from "@/lib/saved-api";
import type { CreateCardInput } from "@/services/todos/schemas";
import { createCard, listBoard } from "@/services/todos/todos";

// The signed-in user's board: every live card, columns in order and cards top to bottom.
export async function GET() {
  return signedIn(null, async (viewer) => reply({ cards: await listBoard(viewer) }, 200));
}

// Adds a card at the top of its column. Anything that is not a JSON object is treated as an empty
// body, so it gets the same 400 field errors as a missing title.
export async function POST(request: Request) {
  return signedIn(request, async (viewer) => {
    const body = (await readJsonObject(request)) ?? {};
    // The service validates the input; the cast only satisfies the compiler.
    return reply({ card: await createCard(viewer, body as CreateCardInput) }, 201);
  });
}
