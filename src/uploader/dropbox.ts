import { readFileSync } from "fs";
import { getDropboxTokens, saveDropboxTokens, type DropboxTokens } from "../config/store.js";
import { UserError } from "../utils/errors.js";

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

async function refreshAccessToken(tokens: DropboxTokens): Promise<DropboxTokens> {
  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${tokens.appKey}:${tokens.appSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new UserError("Failed to refresh Dropbox token. Run `npx x2kobo auth` to re-authorize.");
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  const updated: DropboxTokens = {
    ...tokens,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  saveDropboxTokens(updated);
  return updated;
}

async function getValidToken(): Promise<string> {
  const tokens = getDropboxTokens();
  if (!tokens) {
    throw new UserError("Run `npx x2kobo auth` to set up, or use --no-upload.");
  }

  if (Date.now() >= tokens.expiresAt - 60_000) {
    const refreshed = await refreshAccessToken(tokens);
    return refreshed.accessToken;
  }

  return tokens.accessToken;
}

async function uploadWithRetry(
  accessToken: string,
  fileData: Buffer,
  dropboxPath: string,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            path: dropboxPath,
            mode: "add",
            autorename: true,
            mute: false,
          }),
        },
        body: new Uint8Array(fileData),
      });

      if (response.ok) {
        return;
      }

      const errorText = await response.text();

      if (response.status === 409 && errorText.includes("insufficient_space")) {
        throw new UserError("Dropbox quota is full. File saved locally instead.");
      }

      if (response.status === 401) {
        throw new UserError("Dropbox token is invalid. Run `npx x2kobo auth` to re-authorize.");
      }

      if (attempt < MAX_RETRIES - 1) {
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error: unknown) {
      if (error instanceof UserError) throw error;
      if (attempt === MAX_RETRIES - 1) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Upload failed after ${MAX_RETRIES} retries: ${message}`);
      }
      const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function uploadToDropbox(filePath: string, fileName: string): Promise<void> {
  const accessToken = await getValidToken();
  const fileData = readFileSync(filePath);
  const dropboxPath = `/Apps/Rakuten Kobo/X Articles/${fileName}`;
  await uploadWithRetry(accessToken, fileData, dropboxPath);
}
