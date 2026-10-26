import type { ResourceType, TodoStatus } from "@/db/constants";

// A card as the client sees it. Dates are ISO strings so the card crosses the server/client
// boundary and JSON unchanged.
// `resource` is the linked file: null when none is linked (or it was deleted), `{ available: false }`
// when it is no longer published (never its title or id, so a withdrawn file cannot leak).
export type LinkedFile =
  | { available: true; id: string; title: string; type: ResourceType; courseCode: string }
  | { available: false };

export interface TodoCard {
  id: string;
  status: TodoStatus;
  position: number;
  title: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  statusChangedAt: string;
  resource: LinkedFile | null;
}
