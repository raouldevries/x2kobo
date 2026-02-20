import { chromium, type BrowserContext } from "playwright";
import { join } from "path";
import { homedir } from "os";
import { paths } from "../config/store.js";
import { UserError } from "../utils/errors.js";

let context: BrowserContext | null = null;

export interface BrowserOptions {
  headless?: boolean;
  useSystemChrome?: boolean;
}

function getSystemChromeProfilePath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Google", "Chrome");
  } else if (platform === "linux") {
    return join(homedir(), ".config", "google-chrome");
  } else if (platform === "win32") {
    return join(homedir(), "AppData", "Local", "Google", "Chrome", "User Data");
  }
  throw new UserError(`Unsupported platform for --use-chrome: ${platform}`);
}

export async function getBrowser(options: BrowserOptions = {}): Promise<BrowserContext> {
  if (context) {
    return context;
  }

  const { headless = true, useSystemChrome = false } = options;
  const userDataDir = useSystemChrome ? getSystemChromeProfilePath() : paths.browserData;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      channel: "chrome",
    });
    return context;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Executable doesn't exist")) {
      throw new UserError("Browser not found. Run `npx playwright install chromium` to install.");
    }
    if (useSystemChrome && (message.includes("lock") || message.includes("already running"))) {
      throw new UserError("Chrome is still running. Please close Chrome and try again.");
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
