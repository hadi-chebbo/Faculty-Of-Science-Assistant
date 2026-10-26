import type { TodoStatus } from "@/db/constants";

// A card as the client sees it. Dates are ISO strings so the card crosses the server/client
// boundary and JSON unchanged. A linked `resource` joins this shape in a later slice.
export interface TodoCard {
  id: string;
  status: TodoStatus;
  position: number;
  title: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  statusChangedAt: string;
}
