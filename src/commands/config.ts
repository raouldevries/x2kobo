import { getUserDefaults, saveUserDefaults, VALID_DEFAULT_KEYS, type UserDefaults } from "../config/store.js";

function parseValue(key: keyof UserDefaults, raw: string): boolean | string {
  if (key === "output") return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`Invalid value "${raw}" for ${key}. Expected "true" or "false".`);
}

export function configSet(key: string, value: string): void {
  if (!VALID_DEFAULT_KEYS.includes(key as keyof UserDefaults)) {
    throw new Error(`Unknown config key "${key}". Valid keys: ${VALID_DEFAULT_KEYS.join(", ")}`);
  }
  const typedKey = key as keyof UserDefaults;
  const parsed = parseValue(typedKey, value);
  const defaults = getUserDefaults();
  (defaults as Record<string, unknown>)[typedKey] = parsed;
  saveUserDefaults(defaults);
  console.log(`Set ${key} = ${String(parsed)}`);
}

export function configGet(key: string): void {
  if (!VALID_DEFAULT_KEYS.includes(key as keyof UserDefaults)) {
    throw new Error(`Unknown config key "${key}". Valid keys: ${VALID_DEFAULT_KEYS.join(", ")}`);
  }
  const defaults = getUserDefaults();
  const value = defaults[key as keyof UserDefaults];
  if (value === undefined) {
    console.log(`${key}: (not set)`);
  } else {
    console.log(`${key}: ${String(value)}`);
  }
}

export function configList(): void {
  const defaults = getUserDefaults();
  const entries = Object.entries(defaults).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    console.log("No defaults configured.");
    return;
  }
  for (const [key, value] of entries) {
    console.log(`${key}: ${String(value)}`);
  }
}

export function configReset(): void {
  saveUserDefaults({});
  console.log("All defaults cleared.");
}
