import { describe, it, expect } from "vitest";
import { mergeOptions } from "./merge.js";

describe("mergeOptions", () => {
  it("should use CLI options when provided", () => {
    const result = mergeOptions(
      { noUpload: true, verbose: true },
      { noUpload: false, verbose: false, debug: true },
    );
    expect(result.noUpload).toBe(true);
    expect(result.verbose).toBe(true);
  });

  it("should fall back to defaults when CLI options are undefined", () => {
    const result = mergeOptions({}, { noUpload: true, debug: true, output: "/tmp/out.epub" });
    expect(result.noUpload).toBe(true);
    expect(result.debug).toBe(true);
    expect(result.output).toBe("/tmp/out.epub");
  });

  it("should return undefined for unset options with no defaults", () => {
    const result = mergeOptions({}, {});
    expect(result.noUpload).toBeUndefined();
    expect(result.verbose).toBeUndefined();
    expect(result.debug).toBeUndefined();
    expect(result.output).toBeUndefined();
  });

  it("should allow CLI false to override default true", () => {
    const result = mergeOptions({ noUpload: false }, { noUpload: true });
    expect(result.noUpload).toBe(false);
  });
});
