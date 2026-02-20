import * as readline from "readline";
import { saveDropboxTokens } from "../config/store.js";
import { UserError } from "../utils/errors.js";

function buildAuthUrl(appKey: string): string {
  const params = new URLSearchParams({
    client_id: appKey,
    response_type: "code",
    token_access_type: "offline",
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function exchangeCodeForTokens(
  appKey: string,
  appSecret: string,
  code: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new UserError(`Token exchange failed: ${text}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export async function auth(): Promise<void> {
  const appKey = await prompt("Enter your Dropbox App Key: ");
  if (!appKey) {
    throw new UserError("App Key is required. Create one at https://www.dropbox.com/developers");
  }

  const appSecret = await prompt("Enter your Dropbox App Secret: ");
  if (!appSecret) {
    throw new UserError("App Secret is required.");
  }

  const authUrl = buildAuthUrl(appKey);

  console.log("\nOpen this URL in your browser to authorize x2kobo:");
  console.log(authUrl);
  console.log("");

  const authCode = await prompt("Enter the authorization code: ");
  if (!authCode) {
    throw new UserError("Authorization code is required.");
  }

  console.log("Exchanging code for tokens...");
  const tokens = await exchangeCodeForTokens(appKey, appSecret, authCode);

  saveDropboxTokens({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    appKey,
    appSecret,
  });

  console.log("Dropbox authorization successful! Tokens saved.");
}
