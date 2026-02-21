#!/usr/bin/env node

import { Command } from "commander";
import { isUserError } from "./utils/errors.js";
import { login } from "./commands/login.js";
import { auth } from "./commands/auth.js";
import { convert } from "./commands/convert.js";
import { convertBatch } from "./commands/batch.js";
import { configSet, configGet, configList, configReset } from "./commands/config.js";
import { status } from "./commands/status.js";
import { getUserDefaults } from "./config/store.js";
import { mergeOptions } from "./config/merge.js";

const program = new Command();

program
  .name("x2kobo")
  .description("Convert X (Twitter) Articles into KEPUB files for Kobo e-readers")
  .version("0.1.0");

function resolveConvertOptions(
  cmd: Command,
  options: { upload: boolean; useChrome?: boolean; output?: string; verbose?: boolean; debug?: boolean },
) {
  const defaults = getUserDefaults();
  const cliOptions: Record<string, unknown> = {};

  // Only include options that were explicitly passed on the CLI
  if (cmd.getOptionValueSource("upload") === "cli") {
    cliOptions.noUpload = !options.upload;
  }
  if (cmd.getOptionValueSource("useChrome") === "cli") {
    cliOptions.useChrome = options.useChrome;
  }
  if (cmd.getOptionValueSource("output") === "cli") {
    cliOptions.output = options.output;
  }
  if (cmd.getOptionValueSource("verbose") === "cli") {
    cliOptions.verbose = options.verbose;
  }
  if (cmd.getOptionValueSource("debug") === "cli") {
    cliOptions.debug = options.debug;
  }

  return mergeOptions(cliOptions, defaults);
}

const convertCmd = program
  .command("convert")
  .description("Convert X Article URL(s) to KEPUB file(s)")
  .argument("<urls...>", "X Article URL(s) to convert")
  .option("--no-upload", "Skip Dropbox upload")
  .option("--use-chrome", "Use your system Chrome profile (Chrome must be closed)")
  .option("-o, --output <path>", "Output file path")
  .option("-v, --verbose", "Show verbose output")
  .option("--debug", "Show browser window during conversion")
  .action(
    async (
      urls: string[],
      options: { upload: boolean; useChrome?: boolean; output?: string; verbose?: boolean; debug?: boolean },
    ) => {
      const merged = resolveConvertOptions(convertCmd, options);
      if (urls.length === 1) {
        await convert(urls[0], merged);
      } else {
        await convertBatch(urls, merged);
      }
    },
  );

// Default command: treat arguments as URL(s) for convert
program
  .argument("[urls...]", "X Article URL(s) to convert (shortcut for `convert`)")
  .option("--no-upload", "Skip Dropbox upload")
  .option("--use-chrome", "Use your system Chrome profile (Chrome must be closed)")
  .option("-o, --output <path>", "Output file path")
  .option("-v, --verbose", "Show verbose output")
  .option("--debug", "Show browser window during conversion")
  .action(
    async (
      urls: string[],
      options: { upload: boolean; useChrome?: boolean; output?: string; verbose?: boolean; debug?: boolean },
    ) => {
      const filtered = urls.filter((u) => !u.startsWith("-"));
      if (filtered.length === 0) return;

      const merged = resolveConvertOptions(program, options);
      if (filtered.length === 1) {
        await convert(filtered[0], merged);
      } else {
        await convertBatch(filtered, merged);
      }
    },
  );

program
  .command("login")
  .description("Log into X in a browser window to save your session")
  .action(login);

program.command("auth").description("Set up Dropbox integration with OAuth PKCE").action(auth);

program.command("status").description("Show login and Dropbox connection status").action(status);

const configCmd = program
  .command("config")
  .description("Manage default options");

configCmd
  .command("set")
  .description("Set a default option")
  .argument("<key>", "Option name (noUpload, useChrome, verbose, debug, output)")
  .argument("<value>", "Option value")
  .action(configSet);

configCmd
  .command("get")
  .description("Show a default option value")
  .argument("<key>", "Option name")
  .action(configGet);

configCmd
  .command("list")
  .description("Show all default options")
  .action(configList);

configCmd
  .command("reset")
  .description("Clear all default options")
  .action(configReset);

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
