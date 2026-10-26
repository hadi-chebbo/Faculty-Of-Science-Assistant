import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TODO_MAX_CARDS } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import type { Viewer } from "@/services/viewer";
import { GET, POST } from "./route";

// The session cookie is read through next/headers, which needs a real request; the tests set who
// is signed in directly.
const session = vi.hoisted(() => ({ viewer: null as Viewer }));
vi.mock("@/lib/auth/viewer", () => ({ getViewer: async () => session.viewer }));
// connection() only works inside a real request.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

const ORIGIN = "http://localhost:3210";

function post(body: unknown, headers: Record<string, string> = { origin: ORIGIN, "content-type": "application/json" }) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return POST(new NextRequest(`${ORIGIN}/api/v1/todos`, { method: "POST", headers, body: raw }));
}

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

describe("todo routes", () => {
  it("answer 401 when nobody is signed in", async () => {
    for (const response of [await GET(), await post({ title: "x" })]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "Not signed in" });
    }
  });

  it("refuse a cross-origin or origin-less write with 403", async () => {
    await signIn();
    const refused: Record<string, string>[] = [{ origin: "https://evil.example" }, {}];
    for (const headers of refused) {
      expect((await post({ title: "x" }, headers)).status).toBe(403);
    }
    expect(await getDb().Todo.count()).toBe(0);
  });

  it("answer 400 with the field for an empty, blank or too long title, a long note or bad JSON", async () => {
    await signIn();
    const bad: unknown[] = [{ title: "" }, { title: "   " }, { title: "x".repeat(201) }, {}, "not json", [1], { title: "t", note: "n".repeat(2001) }, { title: "t", status: "later" }];
    for (const body of bad) {
      const response = await post(body);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Invalid input");
      expect(json.fields.length).toBeGreaterThan(0);
    }
    expect((await (await post({ title: "" })).json()).fields).toEqual(["title"]);
    expect(await getDb().Todo.count()).toBe(0);
  });

  it("create a card (201) that GET then lists, newest first", async () => {
    await signIn();
    const first = await post({ title: "  Revise  ", note: "chapter 1" });
    expect(first.status).toBe(201);
    expect(first.headers.get("cache-control")).toBe("no-store");
    const { card } = await first.json();
    expect(card).toMatchObject({ status: "todo", position: 0, title: "Revise", note: "chapter 1" });
    await post({ title: "Second", status: "in_progress" });
    await post({ title: "Third" });

    const response = await GET();
    expect(response.status).toBe(200);
    const { cards } = await response.json();
    expect(cards.map((c: { title: string; position: number }) => [c.title, c.position])).toEqual([
      ["Third", 0], ["Revise", 1], ["Second", 0],
    ]);
  });

  it("list only the signed-in user's cards", async () => {
    const other = await signIn("other@example.com");
    await post({ title: "theirs" });
    await signIn("me@example.com");
    await post({ title: "mine" });
    const { cards } = await (await GET()).json();
    expect(cards.map((c: { title: string }) => c.title)).toEqual(["mine"]);
    expect(await getDb().Todo.count({ where: { userId: other.id } })).toBe(1);
  });

  it("answer 409 board_full at 500 cards", async () => {
    const user = await signIn();
    await getDb().Todo.bulkCreate(
      Array.from({ length: TODO_MAX_CARDS }, (_, i) => ({ userId: user.id, status: "todo" as const, position: i, title: `c${i}` })),
    );
    const response = await post({ title: "one too many" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "board_full" });
    expect(await getDb().Todo.count()).toBe(TODO_MAX_CARDS);
  });
});
