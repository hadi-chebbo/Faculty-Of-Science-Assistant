import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TODO_MAX_CARDS } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { createCard } from "@/services/todos/todos";
import type { Viewer } from "@/services/viewer";
import { GET } from "../route";
import { POST as restore } from "./restore/route";
import { DELETE, PATCH } from "./route";

const session = vi.hoisted(() => ({ viewer: null as Viewer }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => session.viewer }));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

const ORIGIN = "http://localhost:3210";
const SAME = { origin: ORIGIN, "content-type": "application/json" };

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string, id: string, body?: unknown, headers: Record<string, string> = SAME, suffix = "") =>
  new NextRequest(`${ORIGIN}/api/v1/todos/${id}${suffix}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const patch = (id: string, body: unknown, headers?: Record<string, string>) => PATCH(req("PATCH", id, body, headers), ctx(id));
const del = (id: string, headers?: Record<string, string>) => DELETE(req("DELETE", id, undefined, headers), ctx(id));
const undo = (id: string, headers?: Record<string, string>) => restore(req("POST", id, undefined, headers, "/restore"), ctx(id));

beforeEach(async () => {
  await truncateAllTables();
  session.viewer = null;
});
afterAll(closeDb);

async function signIn(email = "s@example.com") {
  const user = await getDb().User.create({ email, passwordHash: "x", emailConfirmedAt: new Date() });
  session.viewer = { id: user.id, role: "student" };
  return user;
}

describe("card routes", () => {
  it("answer 401 when nobody is signed in", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    for (const response of [await patch(id, { title: "x" }), await del(id), await undo(id)]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("refuse a cross-origin or origin-less write with 403", async () => {
    const user = await signIn();
    const card = await createCard({ id: user.id, role: "student" }, { title: "mine" });
    for (const headers of [{ origin: "https://evil.example" }, {}]) {
      expect((await patch(card.id, { title: "x" }, headers)).status).toBe(403);
      expect((await del(card.id, headers)).status).toBe(403);
      expect((await undo(card.id, headers)).status).toBe(403);
    }
    const row = await getDb().Todo.findByPk(card.id);
    expect(row).toMatchObject({ title: "mine", deletedAt: null });
  });

  it("PATCH saves the title and note and answers with the card", async () => {
    const user = await signIn();
    const card = await createCard({ id: user.id, role: "student" }, { title: "old" });
    const response = await patch(card.id, { title: " new ", note: "details" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).card).toMatchObject({ id: card.id, title: "new", note: "details" });
    expect((await (await GET()).json()).cards[0]).toMatchObject({ title: "new", note: "details" });
  });

  it("answer 404 for another user's card, an unknown id and a malformed id", async () => {
    const other = await signIn("other@example.com");
    const theirs = await createCard({ id: other.id, role: "student" }, { title: "theirs" });
    await signIn("me@example.com");
    for (const id of [theirs.id, "00000000-0000-4000-8000-000000000000", "nope"]) {
      expect((await patch(id, { title: "x" })).status).toBe(404);
      expect((await del(id)).status).toBe(404);
      expect((await undo(id)).status).toBe(404);
    }
    expect(await getDb().Todo.findByPk(theirs.id)).toMatchObject({ title: "theirs", deletedAt: null });
  });

  it("answer 400 for a note over 2000 characters and for an empty title on a note card", async () => {
    const user = await signIn();
    const card = await createCard({ id: user.id, role: "student" }, { title: "keep" });
    const long = await patch(card.id, { note: "n".repeat(2001) });
    expect(long.status).toBe(400);
    expect(await long.json()).toEqual({ error: "Invalid input", fields: ["note"] });
    const empty = await patch(card.id, { title: "  " });
    expect(empty.status).toBe(400);
    expect((await empty.json()).fields).toEqual(["title"]);
    expect((await patch(card.id, "not json")).status).toBe(200);
    expect(await getDb().Todo.findByPk(card.id)).toMatchObject({ title: "keep", note: "" });
  });

  it("DELETE answers 204 and the card is gone; DELETE again is still 204", async () => {
    const user = await signIn();
    const card = await createCard({ id: user.id, role: "student" }, { title: "bye" });
    const response = await del(card.id);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect((await del(card.id)).status).toBe(204);
    expect((await (await GET()).json()).cards).toEqual([]);
  });

  it("restore brings the card back to its place and answers with it", async () => {
    const user = await signIn();
    const viewer = { id: user.id, role: "student" as const };
    await createCard(viewer, { title: "c" });
    const middle = await createCard(viewer, { title: "b" });
    await createCard(viewer, { title: "a" });
    await del(middle.id);
    const response = await undo(middle.id);
    expect(response.status).toBe(200);
    expect((await response.json()).card).toMatchObject({ id: middle.id, title: "b", position: 1 });
    expect((await (await GET()).json()).cards.map((c: { title: string }) => c.title)).toEqual(["a", "b", "c"]);
  });

  it("restore answers 409 board_full when 500 cards are live", async () => {
    const user = await signIn();
    const card = await createCard({ id: user.id, role: "student" }, { title: "gone" });
    await del(card.id);
    await getDb().Todo.bulkCreate(
      Array.from({ length: TODO_MAX_CARDS }, (_, i) => ({ userId: user.id, status: "done" as const, position: i, title: `c${i}` })),
    );
    const response = await undo(card.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "board_full" });
  });
});
