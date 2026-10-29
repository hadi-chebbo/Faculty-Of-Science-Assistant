import type { ResourceType, TodoStatus } from "@/db/constants";
import type { Progress, Rewards } from "../progress/types";

// A card as the client sees it. Dates are ISO strings so the card crosses the server/client
// boundary and JSON unchanged.
// `resource` is the linked file (`done`: the viewer has marked it as done): null when none is linked (or it was deleted), `{ available: false }`
// when it is no longer published (never its title or id, so a withdrawn file cannot leak).
export type LinkedFile =
  | { available: true; id: string; title: string; type: ResourceType; courseCode: string; done: boolean }
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

// What moving a card answers. When the move took the card into Done and marked its linked file,
// `fileMarked` is true if the completion is new (false if the file was already done) and `rewards`
// and `progress` describe the mark; in every other case all three are false / null.
export interface MoveResult {
  card: TodoCard;
  fileMarked: boolean;
  rewards: Rewards | null;
  progress: Progress | null;
}
