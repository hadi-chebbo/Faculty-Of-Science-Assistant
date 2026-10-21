import { describe, expect, it, vi } from "vitest";
import { createBrevoMailer } from "./brevo";

const config = { apiKey: "key-123", fromEmail: "noreply@example.com", fromName: "University Assistant" };
const message = { to: "a@example.com", subject: "Hi", text: "plain", html: "<p>html</p>" };

describe("Brevo mailer", () => {
  it("posts the documented request shape", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    await createBrevoMailer(config, fetchMock as unknown as typeof fetch).send(message);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("key-123");
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { email: "noreply@example.com", name: "University Assistant" },
      to: [{ email: "a@example.com" }],
      subject: "Hi",
      htmlContent: "<p>html</p>",
      textContent: "plain",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws the status only: no body, no address", async () => {
    const fetchMock = vi.fn(async () => new Response("a@example.com is invalid key-123", { status: 400 }));
    const error = await createBrevoMailer(config, fetchMock as unknown as typeof fetch)
      .send(message)
      .catch((e: Error) => e);
    expect((error as Error).message).toBe("Brevo send failed with HTTP 400");
  });

  it("lets a timeout or network error through", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    await expect(createBrevoMailer(config, fetchMock as unknown as typeof fetch).send(message)).rejects.toThrow("timed out");
  });
});
