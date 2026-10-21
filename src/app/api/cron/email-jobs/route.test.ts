import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
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
    expect(await response.json()).toEqual({ processed: 0, sent: 0, retried: 0, failed: 0, pruned: 0 });
  });
});
