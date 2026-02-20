import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockServer = {
  listen: vi.fn(),
};

vi.mock("http", () => ({
  createServer: vi.fn().mockReturnValue(mockServer),
}));

vi.mock("../server/handler.js", () => ({
  handleRequest: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
  },
}));

describe("serve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create an HTTP server and listen on the given port", async () => {
    const { createServer } = await import("http");
    mockServer.listen.mockImplementation((_port: number, cb: () => void) => cb());

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { serve } = await import("./serve.js");
    await serve({ port: 4000 });

    expect(createServer).toHaveBeenCalled();
    expect(mockServer.listen).toHaveBeenCalledWith(4000, expect.any(Function));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("4000"));
  });
});
