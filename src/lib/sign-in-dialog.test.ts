import { describe, expect, it } from "vitest";
import { requestSignIn, signInDialog } from "./sign-in-dialog";

describe("sign-in dialog store", () => {
  it("opens with the action and resolves true when signed in", async () => {
    const result = requestSignIn("save");
    expect(signInDialog.get()?.action).toBe("save");
    signInDialog.finish(true);
    await expect(result).resolves.toBe(true);
    expect(signInDialog.get()).toBeNull();
  });

  it("resolves false when dismissed", async () => {
    const result = requestSignIn("mark-done");
    signInDialog.finish(false);
    await expect(result).resolves.toBe(false);
  });

  it("settles an open request as dismissed when another comes", async () => {
    const first = requestSignIn("save");
    const second = requestSignIn("add-to-todo");
    await expect(first).resolves.toBe(false);
    expect(signInDialog.get()?.action).toBe("add-to-todo");
    signInDialog.finish(true);
    await expect(second).resolves.toBe(true);
  });

  it("notifies subscribers", () => {
    let calls = 0;
    const off = signInDialog.subscribe(() => calls++);
    void requestSignIn("save");
    signInDialog.finish(false);
    off();
    expect(calls).toBe(2);
  });
});
