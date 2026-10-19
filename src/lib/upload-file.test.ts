import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UPLOAD_MAX_BYTES } from "@/db/constants";
import {
  BAD_SIZE_MESSAGE,
  MAX_SIZE_LABEL,
  NOT_A_PDF_MESSAGE,
  SignedOutError,
  UPLOAD_FAILED_MESSAGE,
  UploadError,
  checkPdfFile,
  formatFileSize,
  uploadPdf,
} from "./upload-file";

const adminFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin-fetch", () => ({ adminFetch }));

describe("checkPdfFile", () => {
  it("accepts a PDF by type or by extension", () => {
    expect(checkPdfFile({ name: "a.bin", type: "application/pdf", size: 10 })).toBeNull();
    expect(checkPdfFile({ name: "A.PDF", type: "", size: 10 })).toBeNull();
  });

  it("refuses anything else", () => {
    expect(checkPdfFile({ name: "a.png", type: "image/png", size: 10 })).toBe(NOT_A_PDF_MESSAGE);
    expect(checkPdfFile({ name: "a", type: "", size: 10 })).toBe(NOT_A_PDF_MESSAGE);
  });

  it("refuses an empty file and a file over the limit", () => {
    expect(checkPdfFile({ name: "a.pdf", type: "application/pdf", size: 0 })).toBe(BAD_SIZE_MESSAGE);
    expect(checkPdfFile({ name: "a.pdf", type: "application/pdf", size: UPLOAD_MAX_BYTES + 1 })).toBe(BAD_SIZE_MESSAGE);
    expect(checkPdfFile({ name: "a.pdf", type: "application/pdf", size: UPLOAD_MAX_BYTES })).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("uses bytes, KB and MB", () => {
    expect(formatFileSize(1)).toBe("1 byte");
    expect(formatFileSize(500)).toBe("500 bytes");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe("2.4 MB");
  });
});

describe("MAX_SIZE_LABEL", () => {
  it("states the server's limit", () => {
    expect(MAX_SIZE_LABEL).toBe("50 MB");
    expect(BAD_SIZE_MESSAGE).toBe("The file must be a PDF of at most 50 MB.");
  });
});

// A minimal XMLHttpRequest whose outcome the test chooses. Like the real one, abort() fires the
// abort event only for a request that was sent.
class FakeXhr {
  static last: FakeXhr | undefined;
  static outcome: "ok" | "fail" | "network" | "hang" = "ok";
  status = 0;
  headers: Record<string, string> = {};
  opened: [string, string] | null = null;
  sent: unknown = null;
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.opened = [method, url];
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.sent = body;
    queueMicrotask(() => {
      if (FakeXhr.outcome === "hang") return;
      if (FakeXhr.outcome === "network") return this.onerror?.();
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      this.status = FakeXhr.outcome === "ok" ? 204 : 500;
      this.onload?.();
    });
  }
  abort() {
    if (this.sent !== null) this.onabort?.();
  }
}

const grant = { upload: { url: "/api/v1/storage/local?token=t", method: "PUT", headers: { "Content-Type": "application/pdf" } }, ticket: "ticket-1" };
const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const pdf = () => new File(["%PDF-1.4"], "lecture.pdf", { type: "application/pdf" });
const options = (signal = new AbortController().signal) => ({ signal, onProgress: vi.fn(), onSignedOut: vi.fn() });

describe("uploadPdf", () => {
  beforeEach(() => {
    FakeXhr.outcome = "ok";
    FakeXhr.last = undefined;
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    adminFetch.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks for an upload, sends the bytes with the given headers and returns the ticket", async () => {
    adminFetch.mockResolvedValue(jsonResponse(201, grant));
    const opts = options();
    await expect(uploadPdf(pdf(), opts)).resolves.toBe("ticket-1");

    const [url, init] = adminFetch.mock.calls[0];
    expect(url).toBe("/api/v1/uploads");
    expect(JSON.parse(init.body)).toEqual({ size: 8 });
    expect(FakeXhr.last!.opened).toEqual(["PUT", grant.upload.url]);
    expect(FakeXhr.last!.headers).toEqual(grant.upload.headers);
    expect(FakeXhr.last!.sent).toBeInstanceOf(File);
    expect(opts.onProgress).toHaveBeenCalledWith(50);
    expect(opts.onProgress).toHaveBeenLastCalledWith(100);
  });

  it("makes no request for a file that fails the local check", async () => {
    await expect(uploadPdf(new File(["x"], "a.png", { type: "image/png" }), options())).rejects.toThrow(NOT_A_PDF_MESSAGE);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it("reports the size message when the server answers 400", async () => {
    adminFetch.mockResolvedValue(jsonResponse(400, { fields: ["file"] }));
    await expect(uploadPdf(pdf(), options())).rejects.toThrow(BAD_SIZE_MESSAGE);
  });

  it("reports a failed upload when the request or the PUT fails", async () => {
    adminFetch.mockRejectedValueOnce(new TypeError("offline"));
    await expect(uploadPdf(pdf(), options())).rejects.toThrow(UPLOAD_FAILED_MESSAGE);

    adminFetch.mockResolvedValue(jsonResponse(201, grant));
    FakeXhr.outcome = "fail";
    await expect(uploadPdf(pdf(), options())).rejects.toBeInstanceOf(UploadError);
    FakeXhr.outcome = "network";
    await expect(uploadPdf(pdf(), options())).rejects.toThrow(UPLOAD_FAILED_MESSAGE);
  });

  it("aborts the PUT when the signal fires", async () => {
    adminFetch.mockResolvedValue(jsonResponse(201, grant));
    FakeXhr.outcome = "hang";
    const controller = new AbortController();
    const promise = uploadPdf(pdf(), options(controller.signal));
    await vi.waitFor(() => expect(FakeXhr.last).toBeDefined());
    await vi.waitFor(() => expect(FakeXhr.last!.sent).not.toBeNull());
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("settles with an AbortError when cancelled after the grant but before the PUT is sent", async () => {
    const controller = new AbortController();
    adminFetch.mockImplementation(async () => {
      controller.abort();
      return jsonResponse(201, grant);
    });
    await expect(uploadPdf(pdf(), options(controller.signal))).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeXhr.last).toBeUndefined();
  });

  it("throws SignedOutError, not an upload error, when the session has ended", async () => {
    adminFetch.mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }));
    await expect(uploadPdf(pdf(), options())).rejects.toBeInstanceOf(SignedOutError);
  });

  it("refuses a grant without a method", async () => {
    adminFetch.mockResolvedValue(jsonResponse(201, { ...grant, upload: { url: grant.upload.url, headers: grant.upload.headers } }));
    await expect(uploadPdf(pdf(), options())).rejects.toThrow(UPLOAD_FAILED_MESSAGE);
  });
});
