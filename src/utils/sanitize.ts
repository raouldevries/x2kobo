import { UserError } from "./errors.js";

const VALID_HOSTS = ["x.com", "twitter.com", "www.x.com", "www.twitter.com"];

export function validateArticleUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UserError("Invalid URL. Please provide an X Article URL.");
  }

  if (!VALID_HOSTS.includes(parsed.hostname)) {
    throw new UserError("Invalid URL. Please provide an X Article URL.");
  }

  return parsed;
}

export function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

export function buildOutputFilename(
  title: string,
  handle: string,
  sourceUrl: string,
  date?: string,
): string {
  const dateStr = date
    ? new Date(date).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];
  const sanitizedTitle = sanitizeFilename(title);
  const cleanHandle = handle.replace("@", "").toLowerCase();
  const shortHash = simpleHash(sourceUrl);
  return `${dateStr}-${sanitizedTitle}-${cleanHandle}-${shortHash}.kepub.epub`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
}
