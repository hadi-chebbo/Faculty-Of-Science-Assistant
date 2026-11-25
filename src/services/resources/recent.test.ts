import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "../viewer";
import { listRecentResources, RECENT_LIMIT } from "./recent";

const SAMPLE_KEY = "resources/sample.pdf";
const admin: Viewer = { id: "11111111-1111-4111-8111-111111111111", role: "admin" };

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function course() {
  return getDb().Course.create({ code: "TEST301", title: "Course A", semester: 3 });
}

describe("listRecentResources", () => {
  it("is empty when there are no files", async () => {
    expect(await listRecentResources(null)).toEqual([]);
  });

  it("lists the newest published files first with course code, type and added time", async () => {
    const { Resource } = getDb();
    const c = await course();
    const old = await Resource.create({ courseId: c.id, type: "lecture", title: "Old", isPublished: true, fileKey: SAMPLE_KEY, createdAt: new Date("2026-01-01T00:00:00Z") });
    const fresh = await Resource.create({ courseId: c.id, type: "exam", title: "Fresh", academicYearStart: 2025, examSession: "final", isPublished: true, fileKey: SAMPLE_KEY, createdAt: new Date("2026-03-01T00:00:00Z") });
    const items = await listRecentResources(null);
    expect(items.map((i) => i.id)).toEqual([fresh.id, old.id]);
    expect(items[0]).toEqual({ id: fresh.id, title: "Fresh", type: "exam", courseCode: "TEST301", addedAt: new Date("2026-03-01T00:00:00Z") });
  });

  it("never lists a draft for a visitor, but does for an admin", async () => {
    const { Resource } = getDb();
    const c = await course();
    await Resource.create({ courseId: c.id, type: "notes", title: "Draft notes" });
    const published = await Resource.create({ courseId: c.id, type: "notes", title: "Live notes", isPublished: true, fileKey: SAMPLE_KEY });
    expect((await listRecentResources(null)).map((i) => i.id)).toEqual([published.id]);
    expect(await listRecentResources(admin)).toHaveLength(2);
  });

  it("respects the limit", async () => {
    const { Resource } = getDb();
    const c = await course();
    for (let i = 0; i < RECENT_LIMIT + 3; i++) {
      await Resource.create({ courseId: c.id, type: "lecture", title: `File ${i}`, isPublished: true, fileKey: SAMPLE_KEY });
    }
    expect(await listRecentResources(null)).toHaveLength(RECENT_LIMIT);
    expect(await listRecentResources(null, 2)).toHaveLength(2);
  });
});
