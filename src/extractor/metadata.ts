import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { UserError } from "../utils/errors.js";

function quietJsdom(html: string, options: { url?: string; contentType?: string } = {}): JSDOM {
  const virtualConsole = new VirtualConsole();
  // Forward everything except CSS parse errors
  virtualConsole.on("error", () => {});
  return new JSDOM(html, { ...options, virtualConsole });
}

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

interface ReadabilityOptions {
  skipDraftJs?: boolean;
}

function extractWithReadability(
  html: string,
  url: string,
  options: ReadabilityOptions = {},
): string | null {
  const dom = quietJsdom(html, { url });
  if (!options.skipDraftJs) {
    preprocessDraftJs(dom.window.document);
  }
  const reader = new Readability(dom.window.document);
  const result = reader.parse();
  return result?.content ?? null;
}

function extractFallback(html: string, url: string): string | null {
  const dom = quietJsdom(html, { url });
  const doc = dom.window.document;
  const articleView = doc.querySelector('[data-testid="twitterArticleRichTextView"]');
  if (!articleView) return null;

  preprocessDraftJs(doc);
  return articleView.innerHTML;
}

function extractArticleImages(html: string, url: string): string[] {
  const dom = quietJsdom(html, { url });
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
  const dom = quietJsdom(html, { url });
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

export function extractGenericMetadata(
  html: string,
  url: string,
): { title: string; author: string; handle: string; publishDate: string } {
  const dom = quietJsdom(html, { url });
  const doc = dom.window.document;

  let title = "";
  let author = "";
  let publishDate = "";

  // Title: og:title → <title> → first <h1> → hostname
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    title = ogTitle.getAttribute("content")?.trim() ?? "";
  }
  if (!title) {
    title = doc.querySelector("title")?.textContent?.trim() ?? "";
  }
  if (!title) {
    title = doc.querySelector("h1")?.textContent?.trim() ?? "";
  }
  if (!title) {
    try {
      title = new URL(url).hostname;
    } catch {
      title = "Untitled";
    }
  }

  // Author: meta author → article:author → og:site_name → hostname
  const metaAuthor = doc.querySelector('meta[name="author"]');
  if (metaAuthor) {
    author = metaAuthor.getAttribute("content")?.trim() ?? "";
  }
  if (!author) {
    const articleAuthor = doc.querySelector('meta[property="article:author"]');
    if (articleAuthor) {
      author = articleAuthor.getAttribute("content")?.trim() ?? "";
    }
  }
  if (!author) {
    const siteName = doc.querySelector('meta[property="og:site_name"]');
    if (siteName) {
      author = siteName.getAttribute("content")?.trim() ?? "";
    }
  }
  if (!author) {
    try {
      author = new URL(url).hostname;
    } catch {
      author = "Unknown";
    }
  }

  // Publish date: article:published_time → <time datetime>
  const pubTimeMeta = doc.querySelector('meta[property="article:published_time"]');
  if (pubTimeMeta) {
    publishDate = pubTimeMeta.getAttribute("content")?.trim() ?? "";
  }
  if (!publishDate) {
    const timeEl = doc.querySelector("time");
    if (timeEl) {
      publishDate = timeEl.getAttribute("datetime")?.trim() ?? "";
    }
  }

  return { title, author, handle: "", publishDate };
}

// Patterns that indicate the page is an error/block page, not real content.
// Use tight patterns (full-title or end-anchored) to avoid false positives
// on articles *about* these topics (e.g., "Rate Limiting Your API").
const ERROR_PAGE_PATTERNS = [
  /^too many requests( · \w+)?$/i, // "Too many requests · GitHub"
  /^access denied$/i,
  /^403 forbidden$/i,
  /^404 not found$/i,
  /^page not found$/i,
  /^error \d{3}$/i,
  /^\d{3} [a-z ]{1,30}$/i, // "429 Too Many Requests" — capped length to avoid long titles
  /^just a moment\.{0,3}$/i, // Cloudflare "Just a moment..." — not "Just a Moment in Time"
  /^attention required/i, // Cloudflare
  /^captcha/i,
  /^rate limited?$/i,
  /^unauthorized$/i,
  /^blocked$/i,
  /^verify you are human/i,
];

const MIN_WORD_COUNT = 30;
const MIN_CHAR_COUNT = 100;

export function validateExtractedContent(article: ArticleData): void {
  // Check for error page titles
  for (const pattern of ERROR_PAGE_PATTERNS) {
    if (pattern.test(article.title.trim())) {
      throw new UserError(
        `The page returned an error instead of article content: '${article.title}'. Try opening the URL in a browser first.`,
      );
    }
  }

  // Check for sufficient body content.
  // Use word count for Latin scripts, character count as fallback for CJK and others.
  const text = article.bodyHtml.replace(/<[^>]+>/g, " ");
  const visibleText = text.replace(/\s+/g, "");
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < MIN_WORD_COUNT && visibleText.length < MIN_CHAR_COUNT) {
    throw new UserError(
      `No article content could be extracted from the page (only ${words.length} words / ${visibleText.length} characters found). The page may require login, have anti-bot protection, or contain no readable content.`,
    );
  }
}

function extractGitHubRichText(html: string): string | null {
  const dom = quietJsdom(html);
  const scripts = dom.window.document.querySelectorAll("script");
  for (const script of scripts) {
    const text = script.textContent;
    if (!text || !text.includes('"richText"')) continue;
    try {
      const json = JSON.parse(text) as {
        payload?: { codeViewBlobRoute?: { richText?: string } };
      };
      const richText = json.payload?.codeViewBlobRoute?.richText;
      if (richText && richText.length > 100) return richText;
    } catch {
      // Not valid JSON, skip
    }
  }
  return null;
}

export function extractGenericArticle(html: string, url: string, pageTitle: string): ArticleData {
  const { title: extractedTitle, author, handle, publishDate } = extractGenericMetadata(html, url);

  // GitHub: extract rendered markdown from JSON payload
  let bodyHtml: string | null = null;
  let githubTitle: string | null = null;
  try {
    const hostname = new URL(url).hostname;
    if (hostname === "github.com" || hostname.endsWith(".github.com")) {
      bodyHtml = extractGitHubRichText(html);
      if (bodyHtml) {
        // Extract title from first <h1> in the rendered markdown
        const titleDom = quietJsdom(bodyHtml);
        githubTitle = titleDom.window.document.querySelector("h1")?.textContent?.trim() ?? null;
      }
    }
  } catch {
    // Invalid URL, skip GitHub check
  }

  if (!bodyHtml) {
    bodyHtml = extractWithReadability(html, url, { skipDraftJs: true });
  }
  if (!bodyHtml || bodyHtml.trim().length < 100) {
    // Fallback chain: <article> → <main> → <body>
    const dom = quietJsdom(html, { url });
    const doc = dom.window.document;
    bodyHtml =
      doc.querySelector("article")?.innerHTML ??
      doc.querySelector("main")?.innerHTML ??
      doc.body?.innerHTML ??
      bodyHtml ??
      "";
  }

  const readingTime = calculateReadingTime(bodyHtml);

  return {
    title: githubTitle || extractedTitle || pageTitle,
    author,
    handle,
    publishDate,
    bodyHtml,
    sourceUrl: url,
    readingTime,
  };
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
