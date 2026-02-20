import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "http";
import { EventEmitter } from "events";

vi.mock("../commands/convert.js", () => ({
  convert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/sanitize.js", async () => {
  const actual =
    await vi.importActual<typeof import("../utils/sanitize.js")>("../utils/sanitize.js");
  return actual;
});

vi.mock("../utils/errors.js", async () => {
  const actual = await vi.importActual<typeof import("../utils/errors.js")>("../utils/errors.js");
  return actual;
});

function createMockRequest(method: string, url: string, body?: string): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost:3000" };

  if (body !== undefined) {
    process.nextTick(() => {
      req.emit("data", Buffer.from(body));
      req.emit("end");
    });
  } else {
    process.nextTick(() => req.emit("end"));
  }
  return req;
}

function createMockResponse(): ServerResponse & {
  _status: number;
  _headers: Record<string, string>;
  _body: string;
} {
  const res = {
    _status: 0,
    _headers: {} as Record<string, string>,
    _body: "",
    headersSent: false,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      if (headers) res._headers = { ...res._headers, ...headers };
      return res;
    },
    end(data?: string) {
      if (data) res._body = data;
      res.headersSent = true;
    },
  } as unknown as ServerResponse & {
    _status: number;
    _headers: Record<string, string>;
    _body: string;
  };
  return res;
}

describe("handleRequest", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetJobs } = await import("./handler.js");
    resetJobs();
  });

  it("should serve the web UI on GET /", async () => {
    const req = createMockRequest("GET", "/");
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, {});

    expect(res._status).toBe(200);
    expect(res._headers["Content-Type"]).toBe("text/html; charset=utf-8");
    expect(res._body).toContain("x2kobo");
  });

  it("should return health check on GET /api/health", async () => {
    const req = createMockRequest("GET", "/api/health");
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, {});

    expect(res._status).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ status: "ok" });
  });

  it("should return 404 for unknown routes", async () => {
    const req = createMockRequest("GET", "/unknown");
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, {});

    expect(res._status).toBe(404);
  });

  it("should handle CORS preflight", async () => {
    const req = createMockRequest("OPTIONS", "/api/convert");
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, {});

    expect(res._status).toBe(204);
    expect(res._headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("should reject invalid JSON on POST /api/convert", async () => {
    const req = createMockRequest("POST", "/api/convert", "not json");
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, {});

    expect(res._status).toBe(400);
    expect(JSON.parse(res._body)).toEqual({ error: "Invalid JSON body" });
  });

  it("should reject missing url on POST /api/convert", async () => {
    const req = createMockRequest("POST", "/api/convert", JSON.stringify({}));
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, {});

    expect(res._status).toBe(400);
    expect(JSON.parse(res._body)).toEqual({ error: "Missing required field: url" });
  });

  it("should reject invalid article URL on POST /api/convert", async () => {
    const req = createMockRequest(
      "POST",
      "/api/convert",
      JSON.stringify({ url: "https://example.com" }),
    );
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, {});

    expect(res._status).toBe(400);
    expect(JSON.parse(res._body).error).toContain("Invalid URL");
  });

  it("should accept valid URL and return job ID", async () => {
    const req = createMockRequest(
      "POST",
      "/api/convert",
      JSON.stringify({ url: "https://x.com/user/article/123" }),
    );
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, {});

    expect(res._status).toBe(202);
    const body = JSON.parse(res._body);
    expect(body.jobId).toBeDefined();
    expect(body.status).toBe("converting");
  });

  it("should call convert with correct options", async () => {
    const req = createMockRequest(
      "POST",
      "/api/convert",
      JSON.stringify({ url: "https://x.com/user/article/123", noUpload: true }),
    );
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, { useChrome: true });

    // Wait for background conversion
    await new Promise((r) => setTimeout(r, 50));

    const { convert } = await import("../commands/convert.js");
    expect(convert).toHaveBeenCalledWith("https://x.com/user/article/123", {
      noUpload: true,
      useChrome: true,
    });
  });

  it("should track job completion", async () => {
    const req = createMockRequest(
      "POST",
      "/api/convert",
      JSON.stringify({ url: "https://x.com/user/article/123" }),
    );
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, {});
    const { jobId } = JSON.parse(res._body);

    // Wait for conversion to complete
    await new Promise((r) => setTimeout(r, 50));

    // Check job status
    const statusReq = createMockRequest("GET", `/api/jobs/${jobId}`);
    const statusRes = createMockResponse();
    await handleRequest(statusReq, statusRes, {});

    expect(statusRes._status).toBe(200);
    expect(JSON.parse(statusRes._body).status).toBe("done");
  });

  it("should track job errors", async () => {
    const { convert } = await import("../commands/convert.js");
    vi.mocked(convert).mockRejectedValueOnce(new Error("Browser crashed"));

    const req = createMockRequest(
      "POST",
      "/api/convert",
      JSON.stringify({ url: "https://x.com/user/article/123" }),
    );
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, {});
    const { jobId } = JSON.parse(res._body);

    // Wait for conversion to fail
    await new Promise((r) => setTimeout(r, 50));

    const statusReq = createMockRequest("GET", `/api/jobs/${jobId}`);
    const statusRes = createMockResponse();
    await handleRequest(statusReq, statusRes, {});

    expect(statusRes._status).toBe(200);
    expect(JSON.parse(statusRes._body).status).toBe("error");
  });

  it("should return 404 for unknown job ID", async () => {
    const req = createMockRequest("GET", "/api/jobs/nonexistent");
    const res = createMockResponse();

    const { handleRequest } = await import("./handler.js");
    await handleRequest(req, res, {});

    expect(res._status).toBe(404);
  });
});
