import { TODO_MAX_CARDS } from "@/db/constants";
import { renew } from "@/lib/auth/client-session";

export const BOARD_FULL_MESSAGE = `Your board is full (${TODO_MAX_CARDS} cards). Delete some done cards to add more.`;

// One request to the todo API. An expired access token is renewed once, then the request is sent
// again; the caller sees a 401 only when the session could not be renewed.
export async function boardRequest(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options: { keepalive?: boolean } = {},
): Promise<Response> {
  const run = () =>
    fetch(`/api/v1/todos${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive: options.keepalive,
    });
  const first = await run();
  return first.status === 401 && (await renew()) ? run() : first;
}
