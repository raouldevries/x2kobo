import { convert, type ConvertOptions } from "./convert.js";
import { closeBrowser } from "../extractor/browser.js";
import { printBatchSummary } from "../utils/logger.js";

export interface BatchResult {
  url: string;
  success: boolean;
  error?: string;
}

export async function convertBatch(urls: string[], options: ConvertOptions): Promise<void> {
  const results: BatchResult[] = [];

  if (options.output && urls.length > 1) {
    console.warn("Warning: --output is ignored when converting multiple URLs.");
  }

  try {
    for (const url of urls) {
      const perUrlOptions: ConvertOptions = {
        ...options,
        keepBrowserOpen: true,
        output: urls.length > 1 ? undefined : options.output,
      };

      try {
        await convert(url, perUrlOptions);
        results.push({ url, success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ url, success: false, error: message });
      }
    }
  } finally {
    await closeBrowser();
  }

  printBatchSummary(results);

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}
