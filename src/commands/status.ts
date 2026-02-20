import { existsSync } from "fs";
import chalk from "chalk";
import { paths, getDropboxTokens } from "../config/store.js";

export async function status(): Promise<void> {
  console.log(chalk.bold("x2kobo Status"));
  console.log("");

  // Config location
  console.log(`Config directory: ${paths.configDir}`);
  console.log("");

  // X login status
  const browserDataExists = existsSync(paths.browserData);
  if (browserDataExists) {
    console.log(`X Login: ${chalk.green("Session data found")}`);
    console.log("  (Run a conversion to verify if session is still valid)");
  } else {
    console.log(`X Login: ${chalk.red("Not logged in")}`);
    console.log("  Run: npx x2kobo login");
  }
  console.log("");

  // Dropbox status
  const tokens = getDropboxTokens();
  if (tokens) {
    const expired = Date.now() >= tokens.expiresAt;
    if (expired) {
      console.log(`Dropbox: ${chalk.yellow("Token expired (will auto-refresh)")}`);
    } else {
      console.log(`Dropbox: ${chalk.green("Connected")}`);
    }
  } else {
    console.log(`Dropbox: ${chalk.red("Not configured")}`);
    console.log("  Run: npx x2kobo auth");
  }
  console.log("");
}
