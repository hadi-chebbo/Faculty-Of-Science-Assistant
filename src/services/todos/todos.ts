import { Op, QueryTypes, type Transaction } from "sequelize";
import { TODO_MAX_CARDS, TODO_STATUSES } from "@/db/constants";
import { getDb } from "@/db/models";
import type { Todo } from "@/db/models/todo";
import { BoardFullError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import type { Viewer } from "../viewer";
import {
  cardIdSchema,
  createCardSchema,
  moveCardSchema,
  updateCardSchema,
  type CreateCardInput,
  type MoveCardInput,
  type UpdateCardInput,
} from "./schemas";
import type { LinkedFile, TodoCard } from "./types";

// Every function acts only on the viewer's own rows.

// Deleted cards are kept this long so Undo can bring them back.
const SOFT_DELETE_KEEP_MS = 24 * 60 * 60 * 1000;

function linkedFile(row: Todo): LinkedFile | null {
  const resource = row.resource;
  if (!resource) return null;
  if (!resource.isPublished) return { available: false };
  return { available: true, id: resource.id, title: resource.title, type: resource.type, courseCode: resource.course?.code ?? "" };
}

// Loads the resource and its course with the card, so the linked file needs no extra queries.
function withFile(transaction?: Transaction) {
  const { Resource, Course } = getDb();
  return {
    transaction,
    include: [{ model: Resource, as: "resource", include: [{ model: Course, as: "course", attributes: ["code"] }] }],
  };
}

async function reload(id: string, transaction: Transaction): Promise<Todo> {
  const row = await getDb().Todo.findByPk(id, withFile(transaction));
  if (!row) throw new NotFoundError("Card not found");
  return row;
}

// The resource a card may be linked to: published only. A malformed, unknown or unpublished id is
// "not found".
async function linkableResource(resourceId: string, transaction: Transaction): Promise<string> {
  const { Resource } = getDb();
  const found = cardIdSchema.safeParse(resourceId).success
    ? await Resource.findOne({ where: { id: resourceId, isPublished: true }, attributes: ["id"], transaction })
    : null;
  if (!found) throw new NotFoundError("Resource not found");
  return found.id;
}

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
    resource: linkedFile(row),
  };
}

// The viewer's live cards, columns in board order and cards top to bottom. Loading the board also
// removes this user's cards deleted more than a day ago, so no cron is needed.
export async function listBoard(viewer: NonNullable<Viewer>): Promise<TodoCard[]> {
  const { Todo } = getDb();
  await Todo.destroy({
    where: { userId: viewer.id, deletedAt: { [Op.lt]: new Date(Date.now() - SOFT_DELETE_KEEP_MS) } },
  });
  const rows = await Todo.findAll({ where: { userId: viewer.id, deletedAt: null }, order: [["position", "ASC"]], ...withFile() });
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
    const resourceId = data.resourceId === undefined ? null : await linkableResource(data.resourceId, transaction);
    const created = await Todo.create(
      { userId: viewer.id, status: data.status, position: 0, title: data.title, note: data.note, resourceId },
      { transaction },
    );
    return toTodoCard(await reload(created.id, transaction));
  });
}

// The viewer's own card by id, fetched after locking the user's row so board writes run one at a
// time. A malformed id, an unknown one and another user's card are all "not found".
async function lockedCard(viewer: NonNullable<Viewer>, id: string, transaction: Transaction): Promise<Todo> {
  const { User, Todo } = getDb();
  await User.findByPk(viewer.id, { attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE });
  const row = cardIdSchema.safeParse(id).success
    ? await Todo.findOne({ where: { id, userId: viewer.id }, ...withFile(transaction) })
    : null;
  if (!row) throw new NotFoundError("Card not found");
  return row;
}

// Changes the title, note and/or linked file of a live card (`resourceId: null` removes the link).
// A card with no linked file must keep a title.
export async function updateCard(viewer: NonNullable<Viewer>, id: string, input: UpdateCardInput): Promise<TodoCard> {
  const data = parseInput(updateCardSchema, input);
  const { sequelize } = getDb();
  return sequelize.transaction(async (transaction) => {
    const row = await lockedCard(viewer, id, transaction);
    if (row.deletedAt) throw new NotFoundError("Card not found");
    const title = data.title ?? row.title;
    const resourceId =
      data.resourceId === undefined ? row.resourceId : data.resourceId === null ? null : await linkableResource(data.resourceId, transaction);
    if (title === "" && !resourceId) throw new ValidationError(["title"]);
    row.title = title;
    if (data.note !== undefined) row.note = data.note;
    const relinked = resourceId !== row.resourceId;
    row.resourceId = resourceId;
    await row.save({ transaction });
    return toTodoCard(relinked ? await reload(row.id, transaction) : row);
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

// Moves a live card to `index` (0 = top) of a column, which may be its own. The index is clamped
// to the column's length. Both columns are renumbered from 0 in the same transaction, so they stay
// gapless. `statusChangedAt` changes only when the column changes. A move to the place the card
// already has changes nothing. Completions are never touched: Done on the board is not "done" on a
// file.
export async function moveCard(viewer: NonNullable<Viewer>, id: string, input: MoveCardInput): Promise<TodoCard> {
  const data = parseInput(moveCardSchema, input);
  const { sequelize, Todo } = getDb();
  return sequelize.transaction(async (transaction) => {
    const row = await lockedCard(viewer, id, transaction);
    if (row.deletedAt) throw new NotFoundError("Card not found");
    const column = (status: string) =>
      Todo.findAll({ where: { userId: viewer.id, status, deletedAt: null }, order: [["position", "ASC"]], transaction });
    const source = await column(row.status);
    const sameColumn = data.status === row.status;
    const target = sameColumn ? source : await column(data.status);
    const others = target.filter((c) => c.id !== row.id);
    const index = Math.min(data.index, others.length);
    if (sameColumn && source.findIndex((c) => c.id === row.id) === index) return toTodoCard(row);

    const placed = [...others.slice(0, index), row, ...others.slice(index)];
    const closed = sameColumn ? [] : source.filter((c) => c.id !== row.id);
    for (const list of [placed, closed]) {
      for (const [position, card] of list.entries()) {
        const isMoved = card.id === row.id;
        if (card.position === position && !isMoved) continue;
        card.position = position;
        if (isMoved && !sameColumn) {
          card.status = data.status;
          card.statusChangedAt = new Date();
        }
        await card.save({ transaction });
      }
    }
    return toTodoCard(row);
  });
}
