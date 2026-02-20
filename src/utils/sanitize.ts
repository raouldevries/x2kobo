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
