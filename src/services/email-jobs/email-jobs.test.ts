import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { enqueueEmailJob } from "./enqueue";
import { processEmailJob } from "./process";
import { registerEmailHandler } from "./registry";
import { processDueEmailJobs } from "./sweep";

let dir: string;
let logFile: string;
const MINUTE = 60_000;

beforeAll(async () => {
  delete process.env.VERCEL;
  process.env.MAIL_DRIVER = "log";
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "ua-email-jobs-"));
  logFile = path.join(dir, "mail.jsonl");
  process.env.MAIL_LOG_FILE = logFile;
  registerEmailHandler("test-ok", (job) => ({
    subject: "Hello",
    text: `Hi ${String(job.payload.name)}`,
    html: `<p>Hi ${String(job.payload.name)}</p>`,
  }));
  registerEmailHandler("test-nothing", () => null);
  registerEmailHandler("test-boom", () => {
    throw new Error("handler exploded for a@example.com");
  });
});

beforeEach(async () => {
  await truncateAllTables();
  await fs.rm(logFile, { force: true });
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
  await closeDb();
});

const sentLines = async () => {
  try {
    return (await fs.readFile(logFile, "utf8")).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};

async function enqueue(kind: string, to = "Student@Example.com", payload: Record<string, unknown> = { name: "Sam" }) {
  const { sequelize } = getDb();
  return sequelize.transaction((transaction) => enqueueEmailJob({ kind, to, payload }, transaction));
}
const load = (id: string) => getDb().EmailJob.findByPk(id).then((job) => job!);

describe("enqueueEmailJob", () => {
  it("leaves no job when the caller's transaction rolls back", async () => {
    const { sequelize, EmailJob } = getDb();
    await expect(
      sequelize.transaction(async (transaction) => {
        await enqueueEmailJob({ kind: "test-ok", to: "a@example.com" }, transaction);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await EmailJob.count()).toBe(0);
  });

  it("stores a lower-case address, a pending status and an empty payload by default", async () => {
    const { sequelize } = getDb();
    const id = await sequelize.transaction((t) => enqueueEmailJob({ kind: "test-ok", to: " Student@Example.com " }, t));
    const job = await load(id);
    expect(job.toEmail).toBe("student@example.com");
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(0);
    expect(job.payload).toEqual({});
  });
});

describe("processEmailJob", () => {
  it("sends through the mailer and marks the job sent", async () => {
    const id = await enqueue("test-ok");
    expect(await processEmailJob(id)).toBe("sent");
    const job = await load(id);
    expect(job.status).toBe("sent");
    expect(job.attempts).toBe(1);
    expect(job.sentAt).toBeInstanceOf(Date);
    const lines = await sentLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ to: "student@example.com", subject: "Hello", text: "Hi Sam" });
    expect(await processEmailJob(id)).toBe("skipped");
  });

  it("keeps the job pending with growing backoff after a handler error, then fails on the 6th", async () => {
    const id = await enqueue("test-boom");
    const waits = [1, 5, 30, 120, 720];
    for (const [index, minutes] of waits.entries()) {
      const before = Date.now();
      expect(await processEmailJob(id)).toBe("retry");
      const job = await load(id);
      expect(job.status).toBe("pending");
      expect(job.attempts).toBe(index + 1);
      const waited = job.nextAttemptAt.getTime() - before;
      expect(waited).toBeGreaterThan(minutes * MINUTE - 5_000);
      expect(waited).toBeLessThan(minutes * MINUTE + 5_000);
      expect(job.lastError).toBe("handler exploded for [address]");
      // Not due yet: nothing happens until its time.
      expect(await processEmailJob(id)).toBe("skipped");
      await getDb().EmailJob.update({ nextAttemptAt: new Date(Date.now() - MINUTE) }, { where: { id } });
    }
    expect(await processEmailJob(id)).toBe("failed");
    const job = await load(id);
    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(6);
    expect(await sentLines()).toHaveLength(0);
  });

  it("deletes the job and sends nothing when the handler returns null", async () => {
    const id = await enqueue("test-nothing");
    expect(await processEmailJob(id)).toBe("cancelled");
    expect(await getDb().EmailJob.findByPk(id)).toBeNull();
    expect(await sentLines()).toHaveLength(0);
    expect(await processEmailJob(id)).toBe("skipped");
  });

  it("fails a job of an unknown kind at once", async () => {
    const id = await enqueue("nobody-handles-this");
    expect(await processEmailJob(id)).toBe("failed");
    const job = await load(id);
    expect(job.status).toBe("failed");
    expect(job.lastError).toBe("unknown kind");
  });

  it("retries when mail is not configured, without building the message", async () => {
    let built = 0;
    registerEmailHandler("test-count", () => {
      built += 1;
      return { subject: "s", text: "t", html: "h" };
    });
    const id = await enqueue("test-count");
    process.env.VERCEL = "1";
    delete process.env.MAIL_DRIVER;
    try {
      expect(await processEmailJob(id)).toBe("retry");
    } finally {
      delete process.env.VERCEL;
      process.env.MAIL_DRIVER = "log";
    }
    expect(built).toBe(0);
    const job = await load(id);
    expect(job.status).toBe("pending");
    expect(job.lastError).toMatch(/not configured/);
  });

  it("never sends one job twice when processed at the same time", async () => {
    const id = await enqueue("test-ok");
    const outcomes = await Promise.all([processEmailJob(id), processEmailJob(id), processEmailJob(id)]);
    expect(outcomes.filter((o) => o === "sent")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "skipped")).toHaveLength(2);
    expect(await sentLines()).toHaveLength(1);
    expect((await load(id)).attempts).toBe(1);
  });
});

describe("processDueEmailJobs", () => {
  it("processes only due pending jobs, oldest first, and respects the limit", async () => {
    const { EmailJob } = getDb();
    const first = await enqueue("test-ok", "first@example.com");
    const second = await enqueue("test-ok", "second@example.com");
    const later = await enqueue("test-ok", "later@example.com");
    await EmailJob.update({ nextAttemptAt: new Date(Date.now() - 2 * MINUTE) }, { where: { id: first } });
    await EmailJob.update({ nextAttemptAt: new Date(Date.now() - MINUTE) }, { where: { id: second } });
    await EmailJob.update({ nextAttemptAt: new Date(Date.now() + 60 * MINUTE) }, { where: { id: later } });

    const result = await processDueEmailJobs({ limit: 1 });
    expect(result).toMatchObject({ processed: 1, sent: 1 });
    expect((await sentLines()).map((l) => l.to)).toEqual(["first@example.com"]);

    const rest = await processDueEmailJobs();
    expect(rest).toMatchObject({ processed: 1, sent: 1 });
    expect((await load(later)).status).toBe("pending");
    expect((await sentLines()).map((l) => l.to)).toEqual(["first@example.com", "second@example.com"]);
  });

  it("counts cancelled jobs separately", async () => {
    await enqueue("test-nothing");
    await enqueue("test-ok");
    expect(await processDueEmailJobs()).toMatchObject({ processed: 2, sent: 1, cancelled: 1, failed: 0 });
  });

  it("counts retries and failures", async () => {
    await enqueue("test-boom");
    await enqueue("nobody-handles-this");
    expect(await processDueEmailJobs()).toMatchObject({ processed: 2, sent: 0, retried: 1, failed: 1, cancelled: 0 });
  });

  it("deletes sent jobs older than 30 days and failed ones older than 90, nothing else", async () => {
    const { sequelize, EmailJob } = getDb();
    const day = 24 * 60 * MINUTE;
    const make = async (status: "sent" | "failed" | "pending", ageDays: number) => {
      const job = await EmailJob.create({ kind: "test-ok", toEmail: "a@example.com", status, nextAttemptAt: new Date(Date.now() + day) });
      const when = new Date(Date.now() - ageDays * day);
      await sequelize.query("UPDATE email_jobs SET sent_at = $2, updated_at = $2, created_at = $2 WHERE id = $1", {
        bind: [job.id, when],
      });
      return job.id;
    };
    const oldSent = await make("sent", 31);
    const youngSent = await make("sent", 29);
    const oldFailed = await make("failed", 91);
    const youngFailed = await make("failed", 89);
    const oldPending = await make("pending", 200);

    const result = await processDueEmailJobs();
    expect(result.pruned).toBe(2);
    const left = (await EmailJob.findAll()).map((j) => j.id).sort();
    expect(left).toEqual([youngSent, youngFailed, oldPending].sort());
    expect(left).not.toContain(oldSent);
    expect(left).not.toContain(oldFailed);
  });
});
