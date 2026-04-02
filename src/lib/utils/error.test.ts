import { describe, it, expect } from "vitest";
import { getErrorMessage, isCancelLikeError } from "./error";

describe("getErrorMessage", () => {
  it("extracts message from Error instance", () => {
    expect(getErrorMessage(new Error("something broke"))).toBe("something broke");
  });

  it("falls back to String(err) for Error with empty message", () => {
    const err = new Error("");
    expect(getErrorMessage(err)).toBe(String(err));
  });

  it("returns string errors as-is", () => {
    expect(getErrorMessage("plain string error")).toBe("plain string error");
  });

  it("extracts .message from plain objects", () => {
    expect(getErrorMessage({ message: "obj error" })).toBe("obj error");
  });

  it("extracts .msg from plain objects", () => {
    expect(getErrorMessage({ msg: "obj msg" })).toBe("obj msg");
  });

  it("prefers .message over .msg", () => {
    expect(getErrorMessage({ message: "first", msg: "second" })).toBe("first");
  });

  it("JSON-serializes objects without message/msg", () => {
    expect(getErrorMessage({ code: 42 })).toBe('{"code":42}');
  });

  it("skips empty objects", () => {
    expect(getErrorMessage({})).toBe("[object Object]");
  });

  it("handles null", () => {
    expect(getErrorMessage(null)).toBe("null");
  });

  it("handles undefined", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("handles numbers", () => {
    expect(getErrorMessage(404)).toBe("404");
  });

  it("ignores non-string message properties", () => {
    expect(getErrorMessage({ message: 123 })).toBe('{"message":123}');
  });

  it("handles circular references gracefully", () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    // Should not throw — falls back to String()
    const result = getErrorMessage(obj);
    expect(typeof result).toBe("string");
  });
});

describe("isCancelLikeError", () => {
  it("detects 'cancel' in error message", () => {
    expect(isCancelLikeError(new Error("User cancelled"))).toBe(true);
  });

  it("detects 'aborted'", () => {
    expect(isCancelLikeError("Request aborted")).toBe(true);
  });

  it("detects 'abort'", () => {
    expect(isCancelLikeError({ message: "AbortError" })).toBe(true);
  });

  it("detects 'dismiss'", () => {
    expect(isCancelLikeError("dismissed by user")).toBe(true);
  });

  it("returns false for real errors", () => {
    expect(isCancelLikeError(new Error("Network timeout"))).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isCancelLikeError("CANCELLED")).toBe(true);
  });
});
