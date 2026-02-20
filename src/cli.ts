#!/usr/bin/env node

import { Command } from "commander";
import { isUserError } from "./utils/errors.js";
import { login } from "./commands/login.js";
import { auth } from "./commands/auth.js";
import { convert } from "./commands/convert.js";
import { status } from "./commands/status.js";

const program = new Command();

program
  .name("x2kobo")
  .description("Convert X (Twitter) Articles into KEPUB files for Kobo e-readers")
  .version("0.1.0");

program
  .command("convert")
  .description("Convert an X Article URL to a KEPUB file")
  .argument("<url>", "X Article URL to convert")
  .option("--no-upload", "Skip Dropbox upload")
  .option("-o, --output <path>", "Output file path")
  .option("-v, --verbose", "Show verbose output")
  .action(async (url: string, options: { upload: boolean; output?: string; verbose?: boolean }) => {
    await convert(url, {
      noUpload: !options.upload,
      output: options.output,
      verbose: options.verbose,
    });
  });

// Default command: treat first argument as URL for convert
program
  .argument("[url]", "X Article URL to convert (shortcut for `convert`)")
  .option("--no-upload", "Skip Dropbox upload")
  .option("-o, --output <path>", "Output file path")
  .option("-v, --verbose", "Show verbose output")
  .action(
    async (
      url: string | undefined,
      options: { upload: boolean; output?: string; verbose?: boolean },
    ) => {
      if (url && !url.startsWith("-")) {
        await convert(url, {
          noUpload: !options.upload,
          output: options.output,
          verbose: options.verbose,
        });
      }
    },
  );

program
  .command("login")
  .description("Log into X in a browser window to save your session")
  .action(login);

program.command("auth").description("Set up Dropbox integration with OAuth PKCE").action(auth);

program.command("status").description("Show login and Dropbox connection status").action(status);

async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  if (isUserError(error)) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
