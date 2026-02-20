import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".x2kobo");

export const paths = {
  configDir: CONFIG_DIR,
  browserData: join(CONFIG_DIR, "browser-data"),
} as const;
