import { describe, expect, it, vi } from "vitest";
import { createErrorQueue } from "./queue";

describe("createErrorQueue", () => {
  it("keeps at most 10 errors before it is ready", () => {
    const queue = createErrorQueue();
    for (let i = 0; i < 15; i++) queue.push(i);
    const capture = vi.fn();
    queue.ready(capture);
    expect(capture.mock.calls.map(([e]) => e)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("flushes once and then sends straight through", () => {
    const queue = createErrorQueue();
    queue.push("a");
    const capture = vi.fn();
    queue.ready(capture);
    queue.ready(capture);
    queue.push("b");
    expect(capture.mock.calls.map(([e]) => e)).toEqual(["a", "b"]);
  });
});
