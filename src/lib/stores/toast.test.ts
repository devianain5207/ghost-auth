import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast, onToast } from "./toast";

describe("toast", () => {
  beforeEach(() => {
    // Reset listener
    onToast(() => {});
  });

  it("calls registered listener with message", () => {
    const listener = vi.fn();
    onToast(listener);
    toast("Hello");
    expect(listener).toHaveBeenCalledWith("Hello");
  });

  it("does not throw when no listener registered", () => {
    // Replace with a null-like listener by overwriting
    onToast(null as unknown as (msg: string) => void);
    expect(() => toast("orphan")).not.toThrow();
  });

  it("replaces previous listener", () => {
    const first = vi.fn();
    const second = vi.fn();
    onToast(first);
    onToast(second);
    toast("msg");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("msg");
  });

  it("passes through any string content", () => {
    const listener = vi.fn();
    onToast(listener);
    toast("");
    toast("with <html> & special chars");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, "");
    expect(listener).toHaveBeenNthCalledWith(2, "with <html> & special chars");
  });
});
