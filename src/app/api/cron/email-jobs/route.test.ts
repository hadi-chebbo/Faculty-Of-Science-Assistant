import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { GET } from "./route";

const call = (authorization?: string) =>
  GET(new NextRequest("http://localhost/api/cron/email-jobs", { headers: authorization ? { authorization } : {} }));

beforeAll(() => {
  delete process.env.VERCEL;
  process.env.MAIL_DRIVER = "log";
});
beforeEach(async () => {
  await truncateAllTables();
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});
afterAll(closeDb);

describe("GET /api/cron/email-jobs", () => {
  it("answers 503 and does nothing when CRON_SECRET is unset", async () => {
    const response = await call("Bearer anything");
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 401 without or with a wrong bearer", async () => {
    process.env.CRON_SECRET = "right-secret";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong-secret")).status).toBe(401);
    expect((await call("right-secret")).status).toBe(401);
  });

  it("runs the sweep with the right bearer and answers counts, not cached", async () => {
    process.env.CRON_SECRET = "right-secret";
    const response = await call("Bearer right-secret");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ processed: 0, sent: 0, retried: 0, failed: 0, cancelled: 0, pruned: 0, deletedUnconfirmed: 0 });
  });

  it("knows the auth email kinds (never 'unknown kind') and sends the confirmation", async () => {
    process.env.CRON_SECRET = "right-secret";
    const { User, EmailJob } = getDb();
    const user = await User.create({ email: "sweep@example.com", passwordHash: "x" });
    const job = await EmailJob.create({ kind: "confirm-email", toEmail: "sweep@example.com", payload: { userId: user.id } });
    const other = await EmailJob.create({ kind: "already-registered", toEmail: "sweep@example.com" });

    const body = await (await call("Bearer right-secret")).json();
    expect(body).toMatchObject({ processed: 2, sent: 2, failed: 0 });
    for (const id of [job.id, other.id]) {
      const row = (await EmailJob.findByPk(id))!;
      expect(row.status).toBe("sent");
      expect(row.lastError).toBeNull();
    }
  });

  it("deletes students never confirmed within 7 days and reports the count", async () => {
    process.env.CRON_SECRET = "right-secret";
    const { User } = getDb();
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await User.create({ email: "stale@example.com", passwordHash: "x", createdAt: old });
    await User.create({ email: "admin@example.com", passwordHash: "x", role: "admin", createdAt: old });
    await User.create({ email: "fresh@example.com", passwordHash: "x" });

    const body = await (await call("Bearer right-secret")).json();
    expect(body.deletedUnconfirmed).toBe(1);
    expect((await User.findAll()).map((u) => u.email).sort()).toEqual(["admin@example.com", "fresh@example.com"]);
  });
});
