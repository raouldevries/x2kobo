import { describe, it, expect } from "vitest";
import { UserError, isUserError } from "./errors.js";

describe("UserError", () => {
  it("should have isUserError set to true", () => {
    const error = new UserError("test message");
    expect(error.isUserError).toBe(true);
  });

  it("should have the correct message", () => {
    const error = new UserError("something went wrong");
    expect(error.message).toBe("something went wrong");
  });

  it("should have name set to UserError", () => {
    const error = new UserError("test");
    expect(error.name).toBe("UserError");
  });

  it("should be an instance of Error", () => {
    const error = new UserError("test");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("isUserError", () => {
  it("should return true for UserError instances", () => {
    expect(isUserError(new UserError("test"))).toBe(true);
  });

  it("should return false for regular Error instances", () => {
    expect(isUserError(new Error("test"))).toBe(false);
  });

  it("should return false for non-error values", () => {
    expect(isUserError("string")).toBe(false);
    expect(isUserError(null)).toBe(false);
    expect(isUserError(undefined)).toBe(false);
  });
});
