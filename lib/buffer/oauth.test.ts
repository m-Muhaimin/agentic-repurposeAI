import { describe, expect, it, afterEach } from "vitest";
import { appBaseUrl, bufferOAuthRedirectUri } from "./oauth";

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

describe("buffer OAuth redirect URI construction", () => {
  it("builds the callback URI from a clean origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://vervai.onrender.com";
    const request = new Request("https://vervai.onrender.com/api/integrations/buffer/connect");
    expect(bufferOAuthRedirectUri(request)).toBe("https://vervai.onrender.com/api/integrations/buffer/callback");
  });

  it("normalizes a trailing-slash NEXT_PUBLIC_APP_URL so the redirect URI matches the registered one", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://vervai.onrender.com/";
    const request = new Request("https://vervai.onrender.com/api/integrations/buffer/connect");
    expect(bufferOAuthRedirectUri(request)).toBe("https://vervai.onrender.com/api/integrations/buffer/callback");
  });

  it("falls back to the request origin when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const request = new Request("http://localhost:3000/api/integrations/buffer/connect");
    expect(appBaseUrl(request)).toBe("http://localhost:3000");
  });
});