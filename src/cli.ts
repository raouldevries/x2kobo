#!/usr/bin/env node

import { Command } from "commander";
import { isUserError } from "./utils/errors.js";

const program = new Command();

program
  .name("x2kobo")
  .description("Convert X (Twitter) Articles into KEPUB files for Kobo e-readers")
  .version("0.1.0");

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
