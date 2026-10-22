import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { processEmailJob } from "../email-jobs/process";
import "../register-email-handlers";
import { alreadyRegisteredHandler, confirmEmailHandler } from "./emails";
import { signUp } from "./sign-up";
import { hashToken } from "./token-hash";

let dir: string;
let logFile: string;

beforeAll(async () => {
  delete process.env.VERCEL;
  process.env.MAIL_DRIVER = "log";
  process.env.APP_URL = "https://study.example.org/";
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "ua-auth-emails-"));
  logFile = path.join(dir, "mail.jsonl");
  process.env.MAIL_LOG_FILE = logFile;
});

beforeEach(async () => {
  await truncateAllTables();
  await fs.rm(logFile, { force: true });
});

afterAll(async () => {
  delete process.env.APP_URL;
  await fs.rm(dir, { recursive: true, force: true });
  await closeDb();
});

const sent = async () =>
  (await fs.readFile(logFile, "utf8").catch(() => ""))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { to: string; subject: string; text: string; html: string });

const view = (job: { id: string; kind: string; toEmail: string; payload: Record<string, unknown> }) => ({
  ...job,
  attempts: 1,
});

describe("confirm-email handler", () => {
  it("returns null for a deleted user, a confirmed user and a payload without a user", async () => {
    const { User } = getDb();
    const confirmed = await User.create({ email: "c@example.com", passwordHash: "x", emailConfirmedAt: new Date() });
    const base = { id: "j", kind: "confirm-email", toEmail: "c@example.com" };
    expect(await confirmEmailHandler(view({ ...base, payload: { userId: confirmed.id } }))).toBeNull();
    expect(await confirmEmailHandler(view({ ...base, payload: { userId: "00000000-0000-4000-8000-000000000000" } }))).toBeNull();
    expect(await confirmEmailHandler(view({ ...base, payload: {} }))).toBeNull();
    expect(await getDb().EmailConfirmation.count()).toBe(0);
  });

  it("stores only the token's hash, builds the link from APP_URL and says it expires in 24 hours", async () => {
    const { jobId } = await signUp({ email: "s@example.com", password: "a-long-enough-password", ip: "203.0.113.1" });
    await expect(processEmailJob(jobId!)).resolves.toBe("sent");

    const [mail] = await sent();
    expect(mail.to).toBe("s@example.com");
    expect(mail.subject).toBe("Confirm your email");
    const token = mail.text.match(/https:\/\/study\.example\.org\/confirm-email\?token=([A-Za-z0-9_-]{43})/)?.[1];
    expect(token).toBeTruthy();
    expect(mail.html).toContain(`https://study.example.org/confirm-email?token=${token}`);
    expect(mail.text).toContain("24 hours");
    expect(mail.text).toContain("ignore");

    const rows = await getDb().EmailConfirmation.findAll({ raw: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(token!));
    expect(JSON.stringify(rows)).not.toContain(token!);
    const job = (await getDb().EmailJob.findByPk(jobId!))!;
    expect(JSON.stringify(job.toJSON())).not.toContain(token!);
  });

  it("cancels the job (deletes it, sends nothing) when the account was confirmed in the meantime", async () => {
    const { jobId } = await signUp({ email: "s@example.com", password: "a-long-enough-password", ip: "203.0.113.1" });
    await getDb().User.update({ emailConfirmedAt: new Date() }, { where: { email: "s@example.com" } });
    await expect(processEmailJob(jobId!)).resolves.toBe("cancelled");
    expect(await getDb().EmailJob.count()).toBe(0);
    expect(await sent()).toHaveLength(0);
  });

  it("cancels the job when the account was deleted", async () => {
    const { jobId } = await signUp({ email: "s@example.com", password: "a-long-enough-password", ip: "203.0.113.1" });
    await getDb().User.destroy({ where: { email: "s@example.com" } });
    await expect(processEmailJob(jobId!)).resolves.toBe("cancelled");
    expect(await getDb().EmailJob.count()).toBe(0);
  });
});

describe("already-registered handler", () => {
  it("points to the sign-in page and says to ignore the email if it was not them", async () => {
    const content = alreadyRegisteredHandler({ id: "j", kind: "already-registered", toEmail: "a@example.com", payload: {}, attempts: 1 });
    expect(content).toMatchObject({ subject: "You already have an account" });
    const mail = content as { text: string; html: string };
    expect(mail.text).toContain("https://study.example.org/sign-in");
    expect(mail.text).toContain("ignore");
    expect(mail.html).toContain("https://study.example.org/sign-in");
  });

  it("is sent for a confirmed address and creates no token", async () => {
    await getDb().User.create({ email: "a@example.com", passwordHash: "x", emailConfirmedAt: new Date() });
    const { jobId } = await signUp({ email: "a@example.com", password: "a-long-enough-password", ip: "203.0.113.1" });
    await expect(processEmailJob(jobId!)).resolves.toBe("sent");
    expect((await sent())[0].subject).toBe("You already have an account");
    expect(await getDb().EmailConfirmation.count()).toBe(0);
  });
});
