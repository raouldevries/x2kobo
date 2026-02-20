import type { IncomingMessage, ServerResponse } from "http";
import { convert } from "../commands/convert.js";
import { validateArticleUrl } from "../utils/sanitize.js";
import { isUserError } from "../utils/errors.js";
import { serveUI } from "./ui.js";

interface ConvertRequest {
  url: string;
  noUpload?: boolean;
  useChrome?: boolean;
}

interface ConvertJob {
  id: string;
  url: string;
  status: "pending" | "converting" | "done" | "error";
  message?: string;
}

const jobs = new Map<string, ConvertJob>();
let jobCounter = 0;

function generateJobId(): string {
  return `job-${++jobCounter}-${Date.now().toString(36)}`;
}

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: { useChrome?: boolean },
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // Web UI
  if (url.pathname === "/" && req.method === "GET") {
    serveUI(res);
    return;
  }

  // Convert API
  if (url.pathname === "/api/convert" && req.method === "POST") {
    await handleConvert(req, res, options);
    return;
  }

  // Job status API
  if (url.pathname.startsWith("/api/jobs/") && req.method === "GET") {
    const jobId = url.pathname.slice("/api/jobs/".length);
    const job = jobs.get(jobId);
    if (!job) {
      jsonResponse(res, 404, { error: "Job not found" });
      return;
    }
    jsonResponse(res, 200, job);
    return;
  }

  // Health check
  if (url.pathname === "/api/health" && req.method === "GET") {
    jsonResponse(res, 200, { status: "ok" });
    return;
  }

  jsonResponse(res, 404, { error: "Not found" });
}

async function handleConvert(
  req: IncomingMessage,
  res: ServerResponse,
  options: { useChrome?: boolean },
): Promise<void> {
  let body: ConvertRequest;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw) as ConvertRequest;
  } catch {
    jsonResponse(res, 400, { error: "Invalid JSON body" });
    return;
  }

  if (!body.url || typeof body.url !== "string") {
    jsonResponse(res, 400, { error: "Missing required field: url" });
    return;
  }

  try {
    validateArticleUrl(body.url);
  } catch (error: unknown) {
    const message = isUserError(error) ? (error as Error).message : "Invalid URL";
    jsonResponse(res, 400, { error: message });
    return;
  }

  const jobId = generateJobId();
  const job: ConvertJob = { id: jobId, url: body.url, status: "converting" };
  jobs.set(jobId, job);

  // Return immediately with job ID
  jsonResponse(res, 202, { jobId, status: "converting", message: "Conversion started" });

  // Run conversion in background
  try {
    await convert(body.url, {
      noUpload: body.noUpload ?? false,
      useChrome: body.useChrome ?? options.useChrome,
    });
    job.status = "done";
    job.message = "Article converted and uploaded successfully";
  } catch (error: unknown) {
    job.status = "error";
    job.message = isUserError(error) ? (error as Error).message : "Conversion failed";
  }
}

export function resetJobs(): void {
  jobs.clear();
  jobCounter = 0;
}
