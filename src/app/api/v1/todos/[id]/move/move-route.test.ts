import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { createCard } from "@/services/todos/todos";
import type { Viewer } from "@/services/viewer";
import { POST } from "./route";

const session = vi.hoisted(() => ({ viewer: null as Viewer }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => session.viewer }));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

const ORIGIN = "http://localhost:3210";
const SAME = { origin: ORIGIN, "content-type": "application/json" };

const move = (id: string, body: unknown, headers: Record<string, string> = SAME) =>
  POST(
    new NextRequest(`${ORIGIN}/api/v1/todos/${id}/move`, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(async () => {
  await truncateAllTables();
  session.viewer = null;
});
afterAll(closeDb);

async function signIn(email = "s@example.com") {
  const user = await getDb().User.create({ email, passwordHash: "x", emailConfirmedAt: new Date() });
  session.viewer = { id: user.id, role: "student" };
  return { id: user.id, role: "student" as const };
}

describe("POST /api/v1/todos/{id}/move", () => {
  it("answers 401 when nobody is signed in", async () => {
    const response = await move("00000000-0000-4000-8000-000000000000", { status: "done", index: 0 });
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses a cross-origin or origin-less request with 403 and moves nothing", async () => {
    const me = await signIn();
    const card = await createCard(me, { title: "mine" });
    for (const headers of [{ origin: "https://evil.example" }, {}]) {
      expect((await move(card.id, { status: "done", index: 0 }, headers)).status).toBe(403);
    }
    expect(await getDb().Todo.findByPk(card.id)).toMatchObject({ status: "todo" });
  });

  it("answers 404 for another user's card", async () => {
    const other = await signIn("other@example.com");
    const theirs = await createCard(other, { title: "theirs" });
    await signIn("me@example.com");
    expect((await move(theirs.id, { status: "done", index: 0 })).status).toBe(404);
    expect((await move("nope", { status: "done", index: 0 })).status).toBe(404);
    expect(await getDb().Todo.findByPk(theirs.id)).toMatchObject({ status: "todo" });
  });

  it("answers 400 for a bad status, a negative index or no body", async () => {
    const me = await signIn();
    const card = await createCard(me, { title: "keep" });
    const status = await move(card.id, { status: "later", index: 0 });
    expect(status.status).toBe(400);
    expect(await status.json()).toEqual({ error: "Invalid input", fields: ["status"] });
    expect(((await (await move(card.id, { status: "done", index: -1 })).json()) as { fields: string[] }).fields).toEqual(["index"]);
    expect((await move(card.id, undefined)).status).toBe(400);
    expect(await getDb().Todo.findByPk(card.id)).toMatchObject({ status: "todo" });
  });

  it("answers 200 with the moved card, at the top of its new column", async () => {
    const me = await signIn();
    await createCard(me, { title: "already done", status: "done" });
    const card = await createCard(me, { title: "go" });
    const response = await move(card.id, { status: "done", index: 0 });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).card).toMatchObject({ id: card.id, status: "done", position: 0 });
    expect(await getDb().Todo.findOne({ where: { title: "already done" } })).toMatchObject({ position: 1 });
  });
});
