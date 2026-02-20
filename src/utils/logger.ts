import ora, { type Ora } from "ora";
import chalk from "chalk";

let spinner: Ora | null = null;

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
