import { join } from "path";
import { homedir } from "os";
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "fs";

const CONFIG_DIR = join(homedir(), ".x2kobo");

export const paths = {
  configDir: CONFIG_DIR,
  browserData: join(CONFIG_DIR, "browser-data"),
  configFile: join(CONFIG_DIR, "config.json"),
} as const;

export interface DropboxTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  appKey: string;
  appSecret: string;
}

export interface UserDefaults {
  noUpload?: boolean;
  useChrome?: boolean;
  verbose?: boolean;
  debug?: boolean;
  output?: string;
}

export const VALID_DEFAULT_KEYS: (keyof UserDefaults)[] = [
  "noUpload",
  "useChrome",
  "verbose",
  "debug",
  "output",
];

export interface AppConfig {
  dropbox?: DropboxTokens;
  defaults?: UserDefaults;
}

export function loadConfig(): AppConfig {
  try {
    const data = readFileSync(paths.configFile, "utf-8");
    return JSON.parse(data) as AppConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: AppConfig): void {
  mkdirSync(paths.configDir, { recursive: true });
  const tmpFile = `${paths.configFile}.tmp`;
  writeFileSync(tmpFile, JSON.stringify(config, null, 2), "utf-8");
  renameSync(tmpFile, paths.configFile);
}

export function getDropboxTokens(): DropboxTokens | undefined {
  const config = loadConfig();
  return config.dropbox;
}

export function saveDropboxTokens(tokens: DropboxTokens): void {
  const config = loadConfig();
  config.dropbox = tokens;
  saveConfig(config);
}

export function getUserDefaults(): UserDefaults {
  const config = loadConfig();
  return config.defaults ?? {};
}

export function saveUserDefaults(defaults: UserDefaults): void {
  const config = loadConfig();
  config.defaults = defaults;
  saveConfig(config);
}
