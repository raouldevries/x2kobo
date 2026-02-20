import type { Page } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getBrowser } from "./browser.js";
import { validateArticleUrl } from "../utils/sanitize.js";
import { UserError } from "../utils/errors.js";
import { paths } from "../config/store.js";

const ARTICLE_SELECTORS = [
  '[data-testid="twitterArticleReadView"]',
  '[data-testid="twitterArticleRichTextView"]',
];

const LOGIN_SELECTORS = ['[data-testid="loginForm"]', 'input[autocomplete="username"]'];

const TWEET_SELECTOR = '[data-testid="tweetText"]';

const PAGE_TIMEOUT = 30_000;

async function saveDebugSnapshot(page: Page): Promise<string> {
  const debugDir = join(paths.configDir, "debug");
  mkdirSync(debugDir, { recursive: true });
  const filename = `${Date.now()}.html`;
  const filepath = join(debugDir, filename);
  const content = await page.content();
  writeFileSync(filepath, content, "utf-8");
  return filepath;
}

function isLoginRedirect(url: string): boolean {
  return url.includes("/i/flow/login");
}

async function detectLoginWall(page: Page): Promise<boolean> {
  if (isLoginRedirect(page.url())) {
    return true;
  }
  for (const selector of LOGIN_SELECTORS) {
    const el = await page.$(selector);
    if (el) return true;
  }
  return false;
}

async function detectArticle(page: Page): Promise<boolean> {
  for (const selector of ARTICLE_SELECTORS) {
    try {
      await page.waitForSelector(selector, { timeout: PAGE_TIMEOUT });
      return true;
    } catch {
      // continue to next selector
    }
  }

  // Fallback: look for a span with text "Article"
  const fallback = await page.$$eval("span", (spans) =>
    spans.some((s) => s.textContent === "Article"),
  );
  return fallback;
}

async function detectTweet(page: Page): Promise<boolean> {
  const el = await page.$(TWEET_SELECTOR);
  return el !== null;
}

export async function loadArticle(url: string): Promise<Page> {
  validateArticleUrl(url);

  const context = await getBrowser({ headless: true });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
  } catch {
    const snapshot = await saveDebugSnapshot(page);
    throw new UserError(`Page loading timed out after 30 seconds. Debug snapshot: ${snapshot}`);
  }

  if (await detectLoginWall(page)) {
    const snapshot = await saveDebugSnapshot(page);
    throw new UserError(`Run \`npx x2kobo login\` to log in again. Debug snapshot: ${snapshot}`);
  }

  const isArticle = await detectArticle(page);
  if (isArticle) {
    return page;
  }

  if (await detectTweet(page)) {
    const snapshot = await saveDebugSnapshot(page);
    throw new UserError(
      `This appears to be a regular tweet, not an X Article. Debug snapshot: ${snapshot}`,
    );
  }

  const snapshot = await saveDebugSnapshot(page);
  throw new UserError(
    `Could not detect article content within 30 seconds. Debug snapshot: ${snapshot}`,
  );
}
