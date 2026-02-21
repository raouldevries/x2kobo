import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { resolve } from "path";

const cliPath = resolve(import.meta.dirname, "../dist/cli.js");

describe("CLI", () => {
  it("should print help with --help flag", () => {
    const output = execFileSync("node", [cliPath, "--help"], { encoding: "utf-8" });
    expect(output).toContain("x2kobo");
    expect(output).toContain("Convert X (Twitter) Articles into KEPUB files");
  });

  it("should print version with --version flag", () => {
    const output = execFileSync("node", [cliPath, "--version"], { encoding: "utf-8" });
    expect(output.trim()).toBe("0.1.0");
  });

  it("should show variadic urls in convert help", () => {
    const output = execFileSync("node", [cliPath, "convert", "--help"], { encoding: "utf-8" });
    expect(output).toContain("urls");
  });

  it("should have config subcommand", () => {
    const output = execFileSync("node", [cliPath, "config", "--help"], { encoding: "utf-8" });
    expect(output).toContain("set");
    expect(output).toContain("get");
    expect(output).toContain("list");
    expect(output).toContain("reset");
  });
});
