import { describe, it, expect } from "vitest";
import { paths } from "./store.js";
import { homedir } from "os";
import { join } from "path";

describe("paths", () => {
  it("should have configDir under home directory", () => {
    expect(paths.configDir).toBe(join(homedir(), ".x2kobo"));
  });

  it("should have browserData under configDir", () => {
    expect(paths.browserData).toBe(join(homedir(), ".x2kobo", "browser-data"));
  });
});
