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

function extractArticleImages(html: string, url: string): string[] {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const readView = doc.querySelector('[data-testid="twitterArticleReadView"]');
  if (!readView) return [];

  const photoEls = readView.querySelectorAll('[data-testid="tweetPhoto"] img');
  const srcs: string[] = [];
  for (const img of photoEls) {
    const src = img.getAttribute("src");
    if (src && !src.includes("profile_images")) {
      srcs.push(src);
    }
  }
  return srcs;
}

function injectImages(bodyHtml: string, imageSrcs: string[]): string {
  if (imageSrcs.length === 0) return bodyHtml;

  // Filter out images already present in the body
  const missing = imageSrcs.filter((src) => !bodyHtml.includes(src));
  if (missing.length === 0) return bodyHtml;

  const imgTags = missing
    .map((src) => {
      const escaped = src.replace(/&/g, "&amp;");
      return `<img src="${escaped}" alt="" />`;
    })
    .join("\n");
  // Insert after the first opening div or at the start
  const insertPoint = bodyHtml.indexOf(">");
  if (insertPoint > -1) {
    return bodyHtml.slice(0, insertPoint + 1) + "\n" + imgTags + bodyHtml.slice(insertPoint + 1);
  }
  return imgTags + bodyHtml;
}

function calculateReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return Math.ceil(words.length / 230);
}

export function extractMetadata(
  html: string,
  url: string,
): { title: string; author: string; handle: string; publishDate: string } {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  let title = "";
  let author = "Unknown";
  let handle = "";
  let publishDate = "";

  // Extract title from article title element
  const titleEl = doc.querySelector('[data-testid="twitter-article-title"]');
  if (titleEl) {
    title = titleEl.textContent?.trim() ?? "";
  }

  // Extract handle from URL (most reliable source)
  const urlMatch = url.match(/x\.com\/([a-zA-Z0-9_]+)\//);
  if (urlMatch) {
    handle = `@${urlMatch[1]}`;
  }

  // Try to find author display name from article header
  const authorLinks = doc.querySelectorAll('a[role="link"]');
  for (const link of authorLinks) {
    const href = link.getAttribute("href") ?? "";
    const handleFromUrl = handle.replace("@", "");
    if (href === `/${handleFromUrl}`) {
      const text = link.textContent?.trim() ?? "";
      if (text && !text.startsWith("@") && !text.includes("·")) {
        author = text;
        break;
      }
    }
  }

  // Fallback: try UserAvatar container for author name
  if (author === "Unknown" && handle) {
    const handleClean = handle.replace("@", "");
    const avatarContainer = doc.querySelector(
      `[data-testid="UserAvatar-Container-${handleClean}"]`,
    );
    if (avatarContainer) {
      const parentLink = avatarContainer.closest("a");
      if (parentLink?.nextElementSibling) {
        const nameText = parentLink.nextElementSibling.textContent?.trim() ?? "";
        if (nameText) {
          author = nameText.split("\n")[0].trim();
        }
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

  return { title, author, handle, publishDate };
}

export function extractArticle(html: string, url: string, pageTitle: string): ArticleData {
  const { title: extractedTitle, author, handle, publishDate } = extractMetadata(html, url);

  let bodyHtml = extractWithReadability(html, url);
  if (!bodyHtml || bodyHtml.trim().length < 100) {
    bodyHtml = extractFallback(html, url) ?? bodyHtml ?? "";
  }

  // Inject article images that Readability may have stripped
  const articleImages = extractArticleImages(html, url);
  bodyHtml = injectImages(bodyHtml, articleImages);

  const readingTime = calculateReadingTime(bodyHtml);

  return {
    title: extractedTitle || pageTitle,
    author,
    handle,
    publishDate,
    bodyHtml,
    sourceUrl: url,
    readingTime,
  };
}
