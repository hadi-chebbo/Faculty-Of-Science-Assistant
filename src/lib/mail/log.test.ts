import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogMailer } from "./log";

afterEach(() => vi.restoreAllMocks());

describe("log mailer", () => {
  it("appends one JSON line per email to the file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ua-mail-"));
    const file = path.join(dir, "mail.jsonl");
    const mailer = createLogMailer(file, () => new Date("2026-10-21T00:00:00Z"));
    await mailer.send({ to: "a@example.com", subject: "One", text: "t1", html: "h1" });
    await mailer.send({ to: "b@example.com", subject: "Two", text: "t2", html: "h2" });
    const lines = (await fs.readFile(file, "utf8")).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toEqual([
      { to: "a@example.com", subject: "One", text: "t1", html: "h1", time: "2026-10-21T00:00:00.000Z" },
      { to: "b@example.com", subject: "Two", text: "t2", html: "h2", time: "2026-10-21T00:00:00.000Z" },
    ]);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("prints only the recipient and subject without a file", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await createLogMailer().send({ to: "a@example.com", subject: "Hello", text: "SECRET-LINK", html: "SECRET-LINK" });
    expect(log).toHaveBeenCalledWith("[mail] to=a@example.com subject=Hello");
  });
});
