import { describe, expect, it } from "vitest";
import { attachmentDisposition, safeFilename } from "./filename";

describe("safeFilename", () => {
  it("keeps an ordinary name", () => {
    expect(safeFilename("Lecture 1.pdf")).toBe("Lecture 1.pdf");
  });

  it("drops quotes, slashes, semicolons and control characters", () => {
    expect(safeFilename('a"b\\c/d;e\r\nf\u0000g.pdf')).toBe("abcdefg.pdf");
  });

  it("falls back for an empty or missing name", () => {
    expect(safeFilename(undefined)).toBe("file.pdf");
    expect(safeFilename('  ";/ ')).toBe("file.pdf");
  });

  it("limits the length", () => {
    expect(safeFilename("x".repeat(500)).length).toBe(150);
  });
});

describe("attachmentDisposition", () => {
  it("gives an ASCII fallback and the exact UTF-8 name", () => {
    expect(attachmentDisposition("Examen l’été (final).pdf")).toBe(
      `attachment; filename="Examen l_ete (final).pdf"; filename*=UTF-8''Examen%20l%E2%80%99%C3%A9t%C3%A9%20%28final%29.pdf`,
    );
  });

  it("is plain ASCII, so a Response accepts it", () => {
    const value = attachmentDisposition("Cœur – œuvre.pdf");
    expect(value).toMatch(/^[\x20-\x7e]+$/);
    expect(() => new Response(null, { headers: { "Content-Disposition": value } })).not.toThrow();
  });

  it("keeps the sanitising of safeFilename", () => {
    expect(attachmentDisposition('a"b/c\r\nd.pdf')).toBe(`attachment; filename="abcd.pdf"; filename*=UTF-8''abcd.pdf`);
  });
});
