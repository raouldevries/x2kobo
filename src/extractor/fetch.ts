import { JSDOM } from "jsdom";
import { UserError } from "../utils/errors.js";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MIN_HTML_LENGTH = 500;

export interface FetchResult {
  html: string;
  url: string;
  title: string;
}

export async function fetchArticle(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new UserError(`HTTP ${response.status} fetching ${url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error(`Non-HTML content type: ${contentType}`);
  }

  const html = await response.text();

  if (html.length < MIN_HTML_LENGTH) {
    throw new Error(`Response too short (${html.length} chars) — likely an SPA shell`);
  }

  const dom = new JSDOM(html, { url: response.url });
  const title = dom.window.document.querySelector("title")?.textContent?.trim() ?? "";

  return { html, url: response.url, title };
}
