import { getBrowser, closeBrowser } from "../extractor/browser.js";
import { UserError } from "../utils/errors.js";
import * as readline from "readline";

async function waitForEnter(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("", () => {
      rl.close();
      resolve();
    });
  });
}

export async function login(): Promise<void> {
  const context = await getBrowser({ headless: false });
  const page = await context.newPage();

  await page.goto("https://x.com/login");

  console.log("Log into your X account in the browser window.");
  console.log("Press Enter in this terminal when done.");

  await waitForEnter();

  await page.goto("https://x.com/home");
  await page.waitForLoadState("networkidle");

  const isLoggedIn = await page.evaluate(() => {
    return document.querySelector('[data-testid="primaryColumn"]') !== null;
  });

  await closeBrowser();

  if (isLoggedIn) {
    console.log("Login successful! Your session has been saved.");
  } else {
    throw new UserError("Login could not be verified. Please try again with `npx x2kobo login`.");
  }
}
