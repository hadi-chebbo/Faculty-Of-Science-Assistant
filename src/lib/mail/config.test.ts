import { describe, expect, it } from "vitest";
import { parseMailConfig } from "./config";

describe("parseMailConfig", () => {
  it("defaults to the log driver off Vercel", () => {
    expect(parseMailConfig({})).toEqual({ driver: "log" });
    expect(parseMailConfig({ MAIL_LOG_FILE: "/tmp/m.jsonl" })).toEqual({ driver: "log", logFile: "/tmp/m.jsonl" });
  });

  it("treats empty strings as unset", () => {
    expect(parseMailConfig({ MAIL_DRIVER: "", MAIL_LOG_FILE: "" })).toEqual({ driver: "log" });
  });

  it("says mail is not configured on Vercel with no driver", () => {
    expect(() => parseMailConfig({ VERCEL: "1" })).toThrow(/not configured/);
  });

  it("refuses the log driver on Vercel", () => {
    expect(() => parseMailConfig({ VERCEL: "1", MAIL_DRIVER: "log" })).toThrow(/cannot be used on Vercel/);
  });

  it("needs the key and the sender for resend, reported by name only", () => {
    expect(() => parseMailConfig({ MAIL_DRIVER: "resend" })).toThrow("needs RESEND_API_KEY, MAIL_FROM");
    const error = (() => {
      try {
        parseMailConfig({ MAIL_DRIVER: "resend", RESEND_API_KEY: "secret-key" });
      } catch (e) {
        return e as Error;
      }
    })();
    expect(error?.message).toContain("MAIL_FROM");
    expect(error?.message).not.toContain("secret-key");
  });

  it("builds the resend config with the default sender name", () => {
    expect(parseMailConfig({ VERCEL: "1", MAIL_DRIVER: "resend", RESEND_API_KEY: "k", MAIL_FROM: "a@b.co" })).toEqual({
      driver: "resend",
      resend: { apiKey: "k", fromEmail: "a@b.co", fromName: "University Assistant" },
    });
  });

  it("refuses a line break in the sender address or name", () => {
    const base = { MAIL_DRIVER: "resend", RESEND_API_KEY: "k" };
    expect(() => parseMailConfig({ ...base, MAIL_FROM: "a@b.co\nBcc: x@y.z" })).toThrow(/MAIL_FROM: must be one line/);
    expect(() => parseMailConfig({ ...base, MAIL_FROM: "a@b.co", MAIL_FROM_NAME: "Uni\r\nBcc: x@y.z" })).toThrow(/MAIL_FROM_NAME: must be one line/);
  });

  it("no longer accepts brevo", () => {
    expect(() => parseMailConfig({ MAIL_DRIVER: "brevo", BREVO_API_KEY: "k", MAIL_FROM: "a@b.co" })).toThrow(/Invalid mail configuration/);
  });

  it("rejects an unknown driver", () => {
    expect(() => parseMailConfig({ MAIL_DRIVER: "smtp" })).toThrow(/Invalid mail configuration/);
  });
});
