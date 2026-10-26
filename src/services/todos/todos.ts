import { Op, QueryTypes, type Transaction } from "sequelize";
import { TODO_MAX_CARDS, TODO_STATUSES } from "@/db/constants";
import { getDb } from "@/db/models";
import type { Todo } from "@/db/models/todo";
import { BoardFullError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import type { Viewer } from "../viewer";
import { cardIdSchema, createCardSchema, updateCardSchema, type CreateCardInput, type UpdateCardInput } from "./schemas";
import type { TodoCard } from "./types";

// Every function acts only on the viewer's own rows.

// Deleted cards are kept this long so Undo can bring them back.
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

// The viewer's own card by id, fetched after locking the user's row so board writes run one at a
// time. A malformed id, an unknown one and another user's card are all "not found".
async function lockedCard(viewer: NonNullable<Viewer>, id: string, transaction: Transaction): Promise<Todo> {
  const { User, Todo } = getDb();
  await User.findByPk(viewer.id, { attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE });
  const row = cardIdSchema.safeParse(id).success ? await Todo.findOne({ where: { id, userId: viewer.id }, transaction }) : null;
  if (!row) throw new NotFoundError("Card not found");
  return row;
}

// Changes the title and/or note of a live card. A card with no linked file must keep a title.
export async function updateCard(viewer: NonNullable<Viewer>, id: string, input: UpdateCardInput): Promise<TodoCard> {
  const data = parseInput(updateCardSchema, input);
  const { sequelize } = getDb();
  return sequelize.transaction(async (transaction) => {
    const row = await lockedCard(viewer, id, transaction);
    if (row.deletedAt) throw new NotFoundError("Card not found");
    const title = data.title ?? row.title;
    if (title === "" && !row.resourceId) throw new ValidationError(["title"]);
    row.title = title;
    if (data.note !== undefined) row.note = data.note;
    await row.save({ transaction });
    return toTodoCard(row);
  });
}

// Soft delete: the row keeps its column and position so Undo can put it back, and the cards below
// it move up. Deleting a deleted card does nothing.
export async function deleteCard(viewer: NonNullable<Viewer>, id: string): Promise<void> {
  const { sequelize } = getDb();
  await sequelize.transaction(async (transaction) => {
    const row = await lockedCard(viewer, id, transaction);
    if (row.deletedAt) return;
    row.deletedAt = new Date();
    await row.save({ transaction });
    await sequelize.query(
      "UPDATE todos SET position = position - 1 WHERE user_id = :userId AND status = :status AND deleted_at IS NULL AND position > :position",
      { replacements: { userId: viewer.id, status: row.status, position: row.position }, type: QueryTypes.UPDATE, transaction },
    );
  });
}

// Undo of a delete: the card returns to its old column at its old place, or at the bottom when the
// column has become shorter. Restoring a live card does nothing; one past the keep time is gone.
export async function restoreCard(viewer: NonNullable<Viewer>, id: string): Promise<TodoCard> {
  const { sequelize, Todo } = getDb();
  return sequelize.transaction(async (transaction) => {
    const row = await lockedCard(viewer, id, transaction);
    if (!row.deletedAt) return toTodoCard(row);
    if (row.deletedAt.getTime() < Date.now() - SOFT_DELETE_KEEP_MS) throw new NotFoundError("Card not found");
    const live = await Todo.count({ where: { userId: viewer.id, deletedAt: null }, transaction });
    if (live >= TODO_MAX_CARDS) throw new BoardFullError();
    const inColumn = await Todo.count({ where: { userId: viewer.id, status: row.status, deletedAt: null }, transaction });
    const position = Math.min(row.position, inColumn);
    await sequelize.query(
      "UPDATE todos SET position = position + 1 WHERE user_id = :userId AND status = :status AND deleted_at IS NULL AND position >= :position",
      { replacements: { userId: viewer.id, status: row.status, position }, type: QueryTypes.UPDATE, transaction },
    );
    row.position = position;
    row.deletedAt = null;
    await row.save({ transaction });
    return toTodoCard(row);
  });
}
