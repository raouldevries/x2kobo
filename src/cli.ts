#!/usr/bin/env node

import { Command } from "commander";
import { isUserError } from "./utils/errors.js";
import { login } from "./commands/login.js";
import { auth } from "./commands/auth.js";

const program = new Command();

program
  .name("x2kobo")
  .description("Convert X (Twitter) Articles into KEPUB files for Kobo e-readers")
  .version("0.1.0");

program
  .command("login")
  .description("Log into X in a browser window to save your session")
  .action(login);

program.command("auth").description("Set up Dropbox integration with OAuth PKCE").action(auth);

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
