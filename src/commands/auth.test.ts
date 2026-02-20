import { describe, it, expect } from "vitest";
import { auth } from "./auth.js";

describe("auth", () => {
  it("should export auth function", () => {
    expect(typeof auth).toBe("function");
  });
});
