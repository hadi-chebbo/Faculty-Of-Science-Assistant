import { col, fn, ForeignKeyConstraintError, UniqueConstraintError } from "sequelize";
import { getDb } from "@/db/models";
import { requireCurrentAdmin } from "../auth/require-admin";
import { idSchema } from "../chapters/schemas";
import { LecturerInUseError, LecturerNameTakenError, NotFoundError } from "../errors";
import { parseInput } from "../validation";
import type { Viewer } from "../viewer";
import { lecturerInputSchema, type LecturerInput } from "./schemas";
import type { AdminLecturer, SavedLecturer } from "./types";

export { normaliseLecturerName } from "./schemas";

const TITLE = /^(?:dr|pr|prof)\.?\s+/;

// "Dr. Ali Ghorayeb" -> "ali-ghorayeb": accents removed, lowercase, a leading title dropped, every
// run of other characters one hyphen. A name that is only a title keeps it; an empty result is "lecturer".
export function lecturerSlug(name: string): string {
  const folded = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  const withoutTitle = folded.replace(TITLE, "");
  const slugOf = (text: string) => text.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slugOf(withoutTitle) || slugOf(folded) || "lecturer";
}

const toSaved = (l: SavedLecturer): SavedLecturer => ({ id: l.id, name: l.name, slug: l.slug });

// Every lecturer by name (ignoring case) with the number of resources using them, drafts included.
export async function listAdminLecturers(viewer: Viewer): Promise<AdminLecturer[]> {
  await requireCurrentAdmin(viewer);
  const { Lecturer, Resource, sequelize } = getDb();
  const [lecturers, counts] = await Promise.all([
    Lecturer.findAll({ order: [[fn("lower", col("name")), "ASC"], ["name", "ASC"]] }),
    Resource.findAll({
      attributes: ["lecturerId", [fn("count", col("id")), "n"]],
      where: sequelize.where(col("lecturer_id"), "IS NOT", null),
      group: ["lecturerId"],
      raw: true,
    }),
  ]);
  const byLecturer = new Map((counts as unknown as { lecturerId: string; n: string }[]).map((r) => [r.lecturerId, Number(r.n)]));
  return lecturers.map((l) => ({ ...toSaved(l), fileCount: byLecturer.get(l.id) ?? 0 }));
}

// True when a lecturer other than `exceptId` already has this name, ignoring case.
async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const { Lecturer, sequelize } = getDb();
  const rows = await Lecturer.findAll({
    attributes: ["id"],
    where: sequelize.where(fn("lower", col("name")), name.toLowerCase()),
  });
  return rows.some((row) => row.id !== exceptId);
}

// The check before a write is not enough when two saves race; the unique indexes then decide. A
// violation is a taken name when another lecturer now has it; otherwise it was the slug (see create).
async function refuseTakenName<T>(name: string, exceptId: string | undefined, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof UniqueConstraintError && (await nameTaken(name, exceptId))) throw new LecturerNameTakenError();
    throw error;
  }
}

// The slug for a new lecturer: the plain one, or with -2, -3... when it is already used.
async function freeSlug(name: string): Promise<string> {
  const { Lecturer } = getDb();
  const base = lecturerSlug(name);
  const used = new Set((await Lecturer.findAll({ attributes: ["slug"] })).map((l) => l.slug));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function createLecturer(viewer: Viewer, input: LecturerInput): Promise<SavedLecturer> {
  await requireCurrentAdmin(viewer);
  const { name } = parseInput(lecturerInputSchema, input);
  if (await nameTaken(name)) throw new LecturerNameTakenError();
  const write = async () => toSaved(await getDb().Lecturer.create({ name, slug: await freeSlug(name) }));
  // Two creations racing for one slug: the loser picks the next free one.
  return refuseTakenName(name, undefined, () => write().catch((error: unknown) => {
    if (error instanceof UniqueConstraintError) return write();
    throw error;
  }));
}

async function findLecturer(id: string) {
  const lecturer = idSchema.safeParse(id).success ? await getDb().Lecturer.findByPk(id) : null;
  if (!lecturer) throw new NotFoundError("Lecturer not found");
  return lecturer;
}

// A rename never changes the slug, so addresses already shared keep working.
export async function updateLecturer(viewer: Viewer, id: string, input: LecturerInput): Promise<SavedLecturer> {
  await requireCurrentAdmin(viewer);
  const { name } = parseInput(lecturerInputSchema, input);
  const lecturer = await findLecturer(id);
  if (await nameTaken(name, lecturer.id)) throw new LecturerNameTakenError();
  return toSaved(await refuseTakenName(name, lecturer.id, () => lecturer.update({ name })));
}

// Refused while any resource, draft or published, uses the lecturer.
export async function deleteLecturer(viewer: Viewer, id: string): Promise<void> {
  await requireCurrentAdmin(viewer);
  const lecturer = await findLecturer(id);
  const { Resource } = getDb();
  const inUse = async () => Resource.count({ where: { lecturerId: lecturer.id } });
  const before = await inUse();
  if (before > 0) throw new LecturerInUseError(before);
  try {
    await lecturer.destroy();
  } catch (error) {
    if (error instanceof ForeignKeyConstraintError) throw new LecturerInUseError(Math.max(await inUse(), 1));
    throw error;
  }
}
