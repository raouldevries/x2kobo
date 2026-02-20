import { chromium, type BrowserContext } from "playwright";
import { paths } from "../config/store.js";
import { UserError } from "../utils/errors.js";

let context: BrowserContext | null = null;

export interface BrowserOptions {
  headless?: boolean;
}

export async function getBrowser(options: BrowserOptions = {}): Promise<BrowserContext> {
  if (context) {
    return context;
  }

  const { headless = true } = options;

  try {
    context = await chromium.launchPersistentContext(paths.browserData, {
      headless,
    });
    return context;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Executable doesn't exist") || message.includes("browserType.launch")) {
      throw new UserError("Browser not found. Run `npx playwright install chromium` to install.");
    }
    throw error;
  }
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
}
