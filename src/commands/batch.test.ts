import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./convert.js", () => ({
  convert: vi.fn(),
}));

vi.mock("../extractor/browser.js", () => ({
  closeBrowser: vi.fn(),
}));

vi.mock("../utils/logger.js", () => ({
  printBatchSummary: vi.fn(),
}));

describe("convertBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call convert for each URL with keepBrowserOpen", async () => {
    const { convert } = await import("./convert.js");
    const { convertBatch } = await import("./batch.js");

    await convertBatch(
      ["https://x.com/a/1", "https://x.com/b/2"],
      { noUpload: true },
    );

    expect(convert).toHaveBeenCalledTimes(2);
    expect(convert).toHaveBeenCalledWith(
      "https://x.com/a/1",
      expect.objectContaining({ keepBrowserOpen: true }),
    );
    expect(convert).toHaveBeenCalledWith(
      "https://x.com/b/2",
      expect.objectContaining({ keepBrowserOpen: true }),
    );
  });

  it("should continue after a failure", async () => {
    const { convert } = await import("./convert.js");
    vi.mocked(convert)
      .mockRejectedValueOnce(new Error("fail1"))
      .mockResolvedValueOnce(undefined);

    const { convertBatch } = await import("./batch.js");

    await convertBatch(
      ["https://x.com/a/1", "https://x.com/b/2"],
      { noUpload: true },
    );

    expect(convert).toHaveBeenCalledTimes(2);
  });

  it("should close browser once at the end", async () => {
    const { convertBatch } = await import("./batch.js");
    const { closeBrowser } = await import("../extractor/browser.js");

    await convertBatch(["https://x.com/a/1"], { noUpload: true });

    expect(closeBrowser).toHaveBeenCalledTimes(1);
  });

  it("should close browser even when all conversions fail", async () => {
    const { convert } = await import("./convert.js");
    vi.mocked(convert).mockRejectedValue(new Error("fail"));

    const { convertBatch } = await import("./batch.js");
    const { closeBrowser } = await import("../extractor/browser.js");

    await convertBatch(["https://x.com/a/1"], { noUpload: true });

    expect(closeBrowser).toHaveBeenCalledTimes(1);
  });

  it("should set process.exitCode when any URL fails", async () => {
    const { convert } = await import("./convert.js");
    vi.mocked(convert).mockRejectedValueOnce(new Error("fail"));

    const { convertBatch } = await import("./batch.js");

    await convertBatch(["https://x.com/a/1"], { noUpload: true });

    expect(process.exitCode).toBe(1);
  });

  it("should print batch summary with results", async () => {
    const { convert } = await import("./convert.js");
    vi.mocked(convert).mockResolvedValue(undefined);

    const { convertBatch } = await import("./batch.js");
    const { printBatchSummary } = await import("../utils/logger.js");

    await convertBatch(["https://x.com/a/1"], { noUpload: true });

    expect(printBatchSummary).toHaveBeenCalledWith([
      { url: "https://x.com/a/1", success: true },
    ]);
  });

  it("should warn and ignore --output with multiple URLs", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { convert } = await import("./convert.js");
    const { convertBatch } = await import("./batch.js");

    await convertBatch(
      ["https://x.com/a/1", "https://x.com/b/2"],
      { noUpload: true, output: "/tmp/out.epub" },
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("--output is ignored"),
    );
    expect(convert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ output: undefined }),
    );
    warnSpy.mockRestore();
  });
});
