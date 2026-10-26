import { Op, QueryTypes } from "sequelize";
import { TODO_MAX_CARDS, TODO_STATUSES } from "@/db/constants";
import { getDb } from "@/db/models";
import type { Todo } from "@/db/models/todo";
import { BoardFullError } from "../errors";
import { parseInput } from "../validation";
import type { Viewer } from "../viewer";
import { createCardSchema, type CreateCardInput } from "./schemas";
import type { TodoCard } from "./types";

// Every function acts only on the viewer's own rows.

// Deleted cards are kept this long so Undo can bring them back (a later slice).
const SOFT_DELETE_KEEP_MS = 24 * 60 * 60 * 1000;

export function toTodoCard(row: Todo): TodoCard {
  return {
    id: row.id,
    status: row.status,
    position: row.position,
    title: row.title,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    statusChangedAt: row.statusChangedAt.toISOString(),
  };
}

// The viewer's live cards, columns in board order and cards top to bottom. Loading the board also
// removes this user's cards deleted more than a day ago, so no cron is needed.
export async function listBoard(viewer: NonNullable<Viewer>): Promise<TodoCard[]> {
  const { Todo } = getDb();
  await Todo.destroy({
    where: { userId: viewer.id, deletedAt: { [Op.lt]: new Date(Date.now() - SOFT_DELETE_KEEP_MS) } },
  });
  const rows = await Todo.findAll({ where: { userId: viewer.id, deletedAt: null }, order: [["position", "ASC"]] });
  const rank = (status: string) => TODO_STATUSES.indexOf(status as (typeof TODO_STATUSES)[number]);
  return rows.map(toTodoCard).sort((a, b) => rank(a.status) - rank(b.status) || a.position - b.position);
}

// A new card goes to the top of its column and pushes the others down. Serialized per user (the
// user's row is locked) so two requests at once cannot collide or exceed the 500-card limit.
export async function createCard(viewer: NonNullable<Viewer>, input: CreateCardInput): Promise<TodoCard> {
  const data = parseInput(createCardSchema, input);
  const { sequelize, User, Todo } = getDb();
  return sequelize.transaction(async (transaction) => {
    await User.findByPk(viewer.id, { attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE });
    const live = await Todo.count({ where: { userId: viewer.id, deletedAt: null }, transaction });
    if (live >= TODO_MAX_CARDS) throw new BoardFullError();
    await sequelize.query(
      "UPDATE todos SET position = position + 1 WHERE user_id = :userId AND status = :status AND deleted_at IS NULL",
      { replacements: { userId: viewer.id, status: data.status }, type: QueryTypes.UPDATE, transaction },
    );
    const row = await Todo.create(
      { userId: viewer.id, status: data.status, position: 0, title: data.title, note: data.note },
      { transaction },
    );
    return toTodoCard(row);
  });
}
