import { randomBytes, createHash } from "crypto";
import * as readline from "readline";
import { saveDropboxTokens } from "../config/store.js";
import { UserError } from "../utils/errors.js";

function generateCodeVerifier(): string {
  return randomBytes(64).toString("hex").slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  const hash = createHash("sha256").update(verifier).digest("base64url");
  return hash;
}

function buildAuthUrl(appKey: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: appKey,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
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
  code: string,
  codeVerifier: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: appKey,
      code_verifier: codeVerifier,
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

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const authUrl = buildAuthUrl(appKey, codeChallenge);

  console.log("\nOpen this URL in your browser to authorize x2kobo:");
  console.log(authUrl);
  console.log("");

  const authCode = await prompt("Enter the authorization code: ");
  if (!authCode) {
    throw new UserError("Authorization code is required.");
  }

  console.log("Exchanging code for tokens...");
  const tokens = await exchangeCodeForTokens(appKey, authCode, codeVerifier);

  saveDropboxTokens({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    appKey,
  });

  console.log("Dropbox authorization successful! Tokens saved.");
}

export { generateCodeVerifier, generateCodeChallenge, buildAuthUrl };
