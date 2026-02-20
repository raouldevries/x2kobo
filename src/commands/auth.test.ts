import { describe, it, expect } from "vitest";
import { generateCodeVerifier, generateCodeChallenge, buildAuthUrl } from "./auth.js";

describe("auth PKCE", () => {
  it("should generate a 128-character code verifier", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toHaveLength(128);
    expect(verifier).toMatch(/^[a-f0-9]+$/);
  });

  it("should generate different verifiers each time", () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });

  it("should generate a code challenge from verifier", () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    expect(challenge.length).toBeGreaterThan(0);
    // base64url should not contain + or /
    expect(challenge).not.toContain("+");
    expect(challenge).not.toContain("/");
  });

  it("should build auth URL with correct parameters", () => {
    const url = buildAuthUrl("test-app-key", "test-challenge");
    expect(url).toContain("https://www.dropbox.com/oauth2/authorize");
    expect(url).toContain("client_id=test-app-key");
    expect(url).toContain("response_type=code");
    expect(url).toContain("code_challenge=test-challenge");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("token_access_type=offline");
  });
});
