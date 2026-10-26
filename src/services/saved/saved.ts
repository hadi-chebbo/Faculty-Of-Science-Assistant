import { z } from "zod";
import { getDb } from "@/db/models";
import { NotFoundError } from "../errors";
import { toResourceListItem, visibleSolutionsOf } from "../resources/resources";
import type { ResourceListItem } from "../resources/types";
import type { Viewer } from "../viewer";

// Saved resources are stored in `bookmarks`; the interface says "Save". Every function acts only
// on the viewer's own rows.
const idSchema = z.uuid();

function validId(resourceId: string): boolean {
  return idSchema.safeParse(resourceId).success;
}

// Saving twice is fine. Only a published resource can be saved, the admin included: drafts are
// never shown outside /admin. The insert ignores a duplicate, so two requests cannot collide.
export async function saveResource(viewer: NonNullable<Viewer>, resourceId: string): Promise<void> {
  const { Resource, Bookmark } = getDb();
  const resource = validId(resourceId)
    ? await Resource.findOne({ where: { id: resourceId, isPublished: true }, attributes: ["id"] })
    : null;
  if (!resource) throw new NotFoundError("Resource not found");
  await Bookmark.bulkCreate([{ userId: viewer.id, resourceId }], { ignoreDuplicates: true });
}

// Removing something that is not saved succeeds. A student can always remove, published or not.
export async function unsaveResource(viewer: NonNullable<Viewer>, resourceId: string): Promise<void> {
  if (!validId(resourceId)) throw new NotFoundError("Resource not found");
  await getDb().Bookmark.destroy({ where: { userId: viewer.id, resourceId } });
}

// The ids of the viewer's saved resources that are published right now, most recently saved first.
export async function listSavedResourceIds(viewer: NonNullable<Viewer>): Promise<string[]> {
  const { Bookmark, Resource } = getDb();
  const rows = await Bookmark.findAll({
    where: { userId: viewer.id },
    attributes: ["resourceId"],
    include: [{ model: Resource, as: "resource", attributes: [], where: { isPublished: true }, required: true }],
    order: [["createdAt", "DESC"]],
    raw: true,
  });
  return rows.map((row) => row.resourceId);
}

// One course on the Saved page, with the viewer's saved files in it (newest save first).
export interface SavedCourseGroup {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  semester: number;
  items: ResourceListItem[];
}

// The Saved page: the viewer's published saved resources grouped by course. Courses by semester,
// then code; within a course the most recent save first (the bookmark id only breaks ties).
// Solutions are the ones anyone may see, exactly as on the public course lists.
export async function listSavedResources(viewer: NonNullable<Viewer>): Promise<SavedCourseGroup[]> {
  const { Bookmark, Resource, Course } = getDb();
  const bookmarks = await Bookmark.findAll({
    where: { userId: viewer.id },
    include: [
      {
        model: Resource,
        as: "resource",
        where: { isPublished: true },
        required: true,
        include: [{ model: Course, as: "course", required: true }],
      },
    ],
    order: [["createdAt", "DESC"], ["id", "ASC"]],
  });
  const solutions = await visibleSolutionsOf(null, bookmarks.map((bookmark) => bookmark.resourceId));

  const groups = new Map<string, SavedCourseGroup>();
  for (const bookmark of bookmarks) {
    const resource = bookmark.resource!;
    const course = resource.course!;
    let group = groups.get(course.id);
    if (!group) {
      group = { courseId: course.id, courseCode: course.code, courseTitle: course.title, semester: course.semester, items: [] };
      groups.set(course.id, group);
    }
    group.items.push(toResourceListItem(resource, course.code, solutions.get(resource.id) ?? []));
  }
  return [...groups.values()].sort(
    (a, b) => a.semester - b.semester || (a.courseCode < b.courseCode ? -1 : a.courseCode > b.courseCode ? 1 : 0),
  );
}
