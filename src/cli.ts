#!/usr/bin/env node

import { Command } from "commander";
import { isUserError } from "./utils/errors.js";
import { login } from "./commands/login.js";
import { auth } from "./commands/auth.js";
import { convert } from "./commands/convert.js";
import { status } from "./commands/status.js";
import { serve } from "./commands/serve.js";

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
  .option("--use-chrome", "Use your system Chrome profile (Chrome must be closed)")
  .option("-o, --output <path>", "Output file path")
  .option("-v, --verbose", "Show verbose output")
  .option("--debug", "Show browser window during conversion")
  .action(
    async (
      url: string,
      options: {
        upload: boolean;
        useChrome?: boolean;
        output?: string;
        verbose?: boolean;
        debug?: boolean;
      },
    ) => {
      await convert(url, {
        noUpload: !options.upload,
        useChrome: options.useChrome,
        output: options.output,
        verbose: options.verbose,
        debug: options.debug,
      });
    },
  );

// Default command: treat first argument as URL for convert
program
  .argument("[url]", "X Article URL to convert (shortcut for `convert`)")
  .option("--no-upload", "Skip Dropbox upload")
  .option("--use-chrome", "Use your system Chrome profile (Chrome must be closed)")
  .option("-o, --output <path>", "Output file path")
  .option("-v, --verbose", "Show verbose output")
  .option("--debug", "Show browser window during conversion")
  .action(
    async (
      url: string | undefined,
      options: {
        upload: boolean;
        useChrome?: boolean;
        output?: string;
        verbose?: boolean;
        debug?: boolean;
      },
    ) => {
      if (url && !url.startsWith("-")) {
        await convert(url, {
          noUpload: !options.upload,
          useChrome: options.useChrome,
          output: options.output,
          verbose: options.verbose,
          debug: options.debug,
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

program
  .command("serve")
  .description("Start a web server for browser-based and shortcut-based conversion")
  .option("-p, --port <number>", "Port to listen on", "3000")
  .option("--use-chrome", "Use your system Chrome profile (Chrome must be closed)")
  .action(async (options: { port: string; useChrome?: boolean }) => {
    await serve({ port: parseInt(options.port, 10), useChrome: options.useChrome });
  });

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
