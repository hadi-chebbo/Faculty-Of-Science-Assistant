import { col, fn, Op, type WhereOptions } from "sequelize";
import { z } from "zod";
import type { UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { EMAIL_MAX_LENGTH } from "../auth/schemas";
import type { Page } from "../types";
import { blankToUndefined, parseInput } from "../validation";
import { NotFoundError } from "../errors";
import { requireAdmin, type Viewer } from "../viewer";

export const USER_PAGE_SIZE = 50;

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blankToUndefined, schema.optional());

const userFiltersSchema = z.object({
  // Part of an email address, any letter case.
  q: optional(z.string().trim().max(EMAIL_MAX_LENGTH)),
  // Only accounts whose email has not been confirmed.
  unconfirmed: z.boolean().default(false),
  page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10_000).default(1)),
  pageSize: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(100).default(USER_PAGE_SIZE)),
});

export interface UserFilters {
  q?: string;
  unconfirmed?: boolean;
  page?: number;
  pageSize?: number;
}

// One row of the admin users list. Dates are ISO strings.
export interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  emailConfirmedAt: string | null;
  // Creation time of the newest refresh token (a token is rotated on every use); null if none.
  lastActiveAt: string | null;
}

const iso = (value: Date | string | null) => (value === null ? null : new Date(value).toISOString());

// Last activity of the given users in one grouped query: the creation time of each one's newest refresh token.
// Written without a correlated subquery on purpose: the table alias Sequelize gives a model follows the class
// name, which a production build renames.
async function lastActiveByUser(userIds: string[]): Promise<Map<string, Date>> {
  const { RefreshToken } = getDb();
  const newest = await RefreshToken.findAll({
    where: { userId: userIds },
    attributes: ["userId", [fn("max", col("created_at")), "lastActiveAt"]],
    group: ["userId"],
    raw: true,
  });
  return new Map(newest.map((row) => [row.userId, (row as unknown as { lastActiveAt: Date }).lastActiveAt]));
}

// `%`, `_` and the escape character itself would otherwise act as wildcards in ILIKE.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Admin only. Newest sign-up first. The rows and count come from one query, last activity from a second for the same page.
export async function listUsers(viewer: Viewer, filters: UserFilters = {}): Promise<Page<UserListItem>> {
  requireAdmin(viewer);
  const { q, unconfirmed, page, pageSize } = parseInput(userFiltersSchema, filters);
  const { User } = getDb();

  const where: WhereOptions[] = [];
  if (q) where.push({ email: { [Op.iLike]: `%${escapeLike(q)}%` } });
  if (unconfirmed) where.push({ emailConfirmedAt: null });

  const { rows, count } = await User.findAndCountAll({
    where: { [Op.and]: where },
    attributes: ["id", "email", "name", "role", "createdAt", "emailConfirmedAt"],
    order: [["createdAt", "DESC"], ["id", "ASC"]],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    raw: true,
  });

  const lastActive = await lastActiveByUser(rows.map((row) => row.id));

  return {
    items: rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
      emailConfirmedAt: iso(row.emailConfirmedAt),
      lastActiveAt: iso(lastActive.get(row.id) ?? null),
    })),
    total: count,
    page,
    pageSize,
  };
}

export const FAILED_SIGN_IN_WINDOW_DAYS = 7;

// Everything the admin user page shows. Dates are ISO strings.
export interface UserDetail extends UserListItem {
  counts: { saved: number; cards: number; completions: number; milestones: number; activeDays: number };
  // Refresh tokens that are neither revoked nor expired.
  sessions: number;
  // Failed sign-ins for this email in the last 7 days.
  failedSignIns: { count: number; latestAt: string | null };
}

const idSchema = z.uuid();

// Admin only. A malformed or unknown id is NotFoundError. `now` is for tests.
export async function getUserDetail(viewer: Viewer, id: string, now: Date = new Date()): Promise<UserDetail> {
  requireAdmin(viewer);
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw new NotFoundError("User not found");
  const { User, Bookmark, Todo, Completion, Milestone, StudyDay, RefreshToken, FailedSignIn } = getDb();

  const user = await User.findByPk(parsed.data, {
    attributes: ["id", "email", "name", "role", "createdAt", "emailConfirmedAt"],
    raw: true,
  });
  if (!user) throw new NotFoundError("User not found");

  const userId = user.id;
  const since = new Date(now.getTime() - FAILED_SIGN_IN_WINDOW_DAYS * 86_400_000);
  const failedWhere = { email: user.email.toLowerCase(), createdAt: { [Op.gte]: since, [Op.lte]: now } };
  const [saved, cards, completions, milestones, activeDays, sessions, failedCount, failedLatest, lastActive] =
    await Promise.all([
      Bookmark.count({ where: { userId } }),
      Todo.count({ where: { userId, deletedAt: null } }),
      Completion.count({ where: { userId } }),
      Milestone.count({ where: { userId } }),
      StudyDay.count({ where: { userId } }),
      RefreshToken.count({ where: { userId, revokedAt: null, expiresAt: { [Op.gt]: now } } }),
      FailedSignIn.count({ where: failedWhere }),
      FailedSignIn.max<Date, InstanceType<typeof FailedSignIn>>("createdAt", { where: failedWhere }),
      lastActiveByUser([userId]),
    ]);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    emailConfirmedAt: iso(user.emailConfirmedAt),
    lastActiveAt: iso(lastActive.get(userId) ?? null),
    counts: { saved, cards, completions, milestones, activeDays },
    sessions,
    failedSignIns: { count: failedCount, latestAt: failedCount > 0 ? iso(failedLatest) : null },
  };
}
