import { getDb } from "@/db/models";
import type { ResourceType } from "@/db/constants";
import { visibleResources } from "../visibility";
import type { Viewer } from "../viewer";

// How many files the home page's "Recently added" list shows.
export const RECENT_LIMIT = 6;

export interface RecentResource {
  id: string;
  title: string;
  type: ResourceType;
  courseCode: string;
  addedAt: Date;
}

// The newest files the viewer may see (published only, unless an admin), newest first. One query, no schema change.
export async function listRecentResources(viewer: Viewer, limit: number = RECENT_LIMIT): Promise<RecentResource[]> {
  const { Resource, Course } = getDb();
  const rows = await Resource.findAll({
    where: visibleResources(viewer),
    include: [{ model: Course, as: "course", attributes: ["code"], required: true }],
    order: [["createdAt", "DESC"], ["id", "ASC"]],
    limit,
  });
  return rows.map((row) => ({ id: row.id, title: row.title, type: row.type, courseCode: row.course!.code, addedAt: row.createdAt }));
}
