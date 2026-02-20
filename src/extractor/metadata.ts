import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export interface ArticleData {
  title: string;
  author: string;
  handle: string;
  publishDate: string;
  bodyHtml: string;
  sourceUrl: string;
  readingTime: number;
}

function preprocessDraftJs(document: Document): void {
  // Map div.public-DraftStyleDefault-block to <p>
  const draftBlocks = document.querySelectorAll("div.public-DraftStyleDefault-block");
  for (const block of draftBlocks) {
    const p = document.createElement("p");
    p.innerHTML = block.innerHTML;
    for (const attr of Array.from(block.attributes)) {
      if (attr.name === "class" || attr.name.startsWith("data-")) continue;
      p.setAttribute(attr.name, attr.value);
    }
    block.replaceWith(p);
  }

  // Strip Draft.js data attributes
  const dataAttrs = ["data-offset-key", "data-block", "data-editor"];
  for (const attr of dataAttrs) {
    const elements = document.querySelectorAll(`[${attr}]`);
    for (const el of elements) {
      el.removeAttribute(attr);
    }
  }

  // Unwrap nested single-child div wrappers
  const allDivs = document.querySelectorAll("div");
  for (const div of allDivs) {
    if (div.children.length === 1 && div.children[0].tagName === "DIV") {
      div.replaceWith(div.children[0]);
    }
  }
}

function extractWithReadability(html: string, url: string): string | null {
  const dom = new JSDOM(html, { url });
  preprocessDraftJs(dom.window.document);
  const reader = new Readability(dom.window.document);
  const result = reader.parse();
  return result?.content ?? null;
}

function extractFallback(html: string, url: string): string | null {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const articleView = doc.querySelector('[data-testid="twitterArticleRichTextView"]');
  if (!articleView) return null;

  preprocessDraftJs(doc);
  return articleView.innerHTML;
}

function calculateReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return Math.ceil(words.length / 230);
}

export function extractMetadata(
  html: string,
  url: string,
): { author: string; handle: string; publishDate: string } {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  // Extract author from meta tags or page content
  let author = "Unknown";
  let handle = "";
  let publishDate = "";

  // Try og:title for author name
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    const content = ogTitle.getAttribute("content") ?? "";
    // Format: "Article Title by Author Name"
    const byMatch = content.match(/by\s+(.+)$/);
    if (byMatch) {
      author = byMatch[1].trim();
    }
  }

  // Try to find author from article header area
  const authorLinks = doc.querySelectorAll('a[role="link"]');
  for (const link of authorLinks) {
    const href = link.getAttribute("href") ?? "";
    if (href.match(/^\/[a-zA-Z0-9_]+$/) && !href.includes("/status/")) {
      const text = link.textContent?.trim() ?? "";
      if (text.startsWith("@")) {
        handle = text;
      } else if (text && text !== author && !text.includes("·")) {
        author = text;
      }
    }
  }

  // Try time element for publish date
  const timeEl = doc.querySelector("time");
  if (timeEl) {
    const datetime = timeEl.getAttribute("datetime");
    if (datetime) {
      publishDate = datetime;
    }
  }

  return { author, handle, publishDate };
}

export function extractArticle(html: string, url: string, title: string): ArticleData {
  const { author, handle, publishDate } = extractMetadata(html, url);

  let bodyHtml = extractWithReadability(html, url);
  if (!bodyHtml || bodyHtml.trim().length < 100) {
    bodyHtml = extractFallback(html, url) ?? bodyHtml ?? "";
  }

  const readingTime = calculateReadingTime(bodyHtml);

  return {
    title,
    author,
    handle,
    publishDate,
    bodyHtml,
    sourceUrl: url,
    readingTime,
  };
}
