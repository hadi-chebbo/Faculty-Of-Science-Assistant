import { describe, expect, it, vi } from "vitest";
import { createResendMailer, resendFrom } from "./resend";

const config = { apiKey: "re_key-123", fromEmail: "noreply@mail.example.com", fromName: "University Assistant" };
const message = { to: "a@example.com", subject: "Hi", text: "plain", html: "<p>html</p>" };

describe("Resend mailer", () => {
  it("posts the documented request shape", async () => {
    const fetchMock = vi.fn(async () => new Response('{"id":"abc"}', { status: 200 }));
    await createResendMailer(config, fetchMock as unknown as typeof fetch).send(message);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_key-123");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      from: '"University Assistant" <noreply@mail.example.com>',
      to: ["a@example.com"],
      subject: "Hi",
      html: "<p>html</p>",
      text: "plain",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws the status only: no body, no address, no key", async () => {
    const fetchMock = vi.fn(async () => new Response("a@example.com is invalid re_key-123", { status: 422 }));
    const error = await createResendMailer(config, fetchMock as unknown as typeof fetch)
      .send(message)
      .catch((e: Error) => e);
    expect((error as Error).message).toBe("Resend send failed with HTTP 422");
  });

  it("lets a timeout or network error through", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    await expect(createResendMailer(config, fetchMock as unknown as typeof fetch).send(message)).rejects.toThrow("timed out");
  });
});

describe("resendFrom", () => {
  it("writes the sender as a quoted display name and an address", () => {
    expect(resendFrom("Unimate", "noreply@mail.example.com")).toBe('"Unimate" <noreply@mail.example.com>');
  });

  it("escapes quotes and backslashes in the name so it cannot break out of the header", () => {
    expect(resendFrom('Uni "Mate" \\ co', "a@b.co")).toBe('"Uni \\"Mate\\" \\\\ co" <a@b.co>');
  });
});
