import { col, fn, Op, type WhereOptions } from "sequelize";
import { z } from "zod";
import type { UserRole } from "@/db/constants";
import { getDb } from "@/db/models";
import { EMAIL_MAX_LENGTH } from "../auth/schemas";
import type { Page } from "../types";
import { blankToUndefined, parseInput } from "../validation";
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

  // Last activity for just this page's users, in one grouped query (not one per user). Written without a
  // correlated subquery on purpose: the table alias Sequelize gives a model follows the class name, which a
  // production build renames.
  const { RefreshToken } = getDb();
  const newest = await RefreshToken.findAll({
    where: { userId: rows.map((row) => row.id) },
    attributes: ["userId", [fn("max", col("created_at")), "lastActiveAt"]],
    group: ["userId"],
    raw: true,
  });
  const lastActive = new Map(newest.map((row) => [row.userId, (row as unknown as { lastActiveAt: Date }).lastActiveAt]));

  const iso = (value: Date | string | null) => (value === null ? null : new Date(value).toISOString());
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
