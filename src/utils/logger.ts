import ora, { type Ora } from "ora";
import chalk from "chalk";

let spinner: Ora | null = null;
let verboseEnabled = false;

export function setVerbose(enabled: boolean): void {
  verboseEnabled = enabled;
}

export function verbose(message: string): void {
  if (!verboseEnabled) return;
  if (spinner) {
    spinner.stop();
  }
  console.log(chalk.dim(`  [verbose] ${message}`));
  if (spinner) {
    spinner.start();
  }
}

export function startSpinner(text: string): void {
  spinner = ora(text).start();
}

export function updateSpinner(text: string): void {
  if (spinner) {
    spinner.text = text;
  }
}

export function succeedSpinner(text: string): void {
  if (spinner) {
    spinner.succeed(text);
    spinner = null;
  }
}

export function failSpinner(text: string): void {
  if (spinner) {
    spinner.fail(text);
    spinner = null;
  }
}

export function stopSpinner(): void {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}

export function printSummary(info: {
  title: string;
  author: string;
  readingTime: number;
  imageCount: number;
  totalImages: number;
  fileSize: number;
  filePath: string;
  uploaded: boolean;
  dropboxPath?: string;
}): void {
  console.log("");
  console.log(chalk.bold("Conversion complete!"));
  console.log("");
  console.log(`  Title:        ${info.title}`);
  console.log(`  Author:       ${info.author}`);
  console.log(`  Reading time: ${info.readingTime} min`);
  if (info.totalImages > 0) {
    console.log(`  Images:       ${info.imageCount} of ${info.totalImages} downloaded`);
  }
  console.log(`  File size:    ${(info.fileSize / 1024).toFixed(1)} KB`);
  console.log(`  Saved to:     ${info.filePath}`);
  if (info.uploaded && info.dropboxPath) {
    console.log(`  Dropbox:      ${info.dropboxPath}`);
  }
  console.log("");
}

export function printBatchSummary(
  results: Array<{ url: string; success: boolean; error?: string }>,
): void {
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);

  console.log("");
  console.log(chalk.bold("Batch complete!"));
  console.log(`  ${succeeded} of ${results.length} articles converted successfully`);

  if (failed.length > 0) {
    console.log("");
    console.log(chalk.red("  Failed:"));
    for (const f of failed) {
      console.log(chalk.red(`    ${f.url}: ${f.error}`));
    }
  }
  console.log("");
}
