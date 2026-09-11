import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveFallbackEndpoint, generateOutputViaFallbackLlm } from "./openrouter";

// Mock PROMPTS so tests don't depend on the full prompt map.
vi.mock("@/lib/ai/prompts", () => ({
  PROMPTS: { linkedin_post: "system-prompt" }
}));

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveFallbackEndpoint", () => {
  it("returns OpenRouter defaults when no LLM_* env vars are set", () => {
    const ep = resolveFallbackEndpoint();
    expect(ep.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(ep.model).toBe("meta-llama/llama-3.3-70b-instruct");
    expect(ep.apiKey).toBe("");
  });

  it("honors OPENROUTER_API_KEY / OPENROUTER_MODEL as legacy overrides", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("OPENROUTER_MODEL", "meta-llama/or-model");
    const ep = resolveFallbackEndpoint();
    expect(ep.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(ep.model).toBe("meta-llama/or-model");
    expect(ep.apiKey).toBe("or-key");
  });

  it("LLM_* env vars override OpenRouter defaults", () => {
    vi.stubEnv("LLM_BASE_URL", "https://9router.example.com/v1");
    vi.stubEnv("LLM_MODEL", "ollama/gpt-oss:120b");
    vi.stubEnv("LLM_API_KEY", "sk-custom");
    const ep = resolveFallbackEndpoint();
    expect(ep.baseUrl).toBe("https://9router.example.com/v1");
    expect(ep.model).toBe("ollama/gpt-oss:120b");
    expect(ep.apiKey).toBe("sk-custom");
  });

  it("LLM_API_KEY takes precedence over OPENROUTER_API_KEY", () => {
    vi.stubEnv("LLM_API_KEY", "sk-prefers-llm");
    vi.stubEnv("OPENROUTER_API_KEY", "or-fallback");
    const ep = resolveFallbackEndpoint();
    expect(ep.apiKey).toBe("sk-prefers-llm");
  });

  it("strips trailing slashes from baseUrl", () => {
    vi.stubEnv("LLM_BASE_URL", "https://example.com/v1///");
    const ep = resolveFallbackEndpoint();
    expect(ep.baseUrl).toBe("https://example.com/v1");
  });
});

describe("generateOutputViaFallbackLlm", () => {
  it("throws when no API key is configured", async () => {
    await expect(
      generateOutputViaFallbackLlm("linkedin_post", "hello world")
    ).rejects.toThrow(/No fallback LLM API key/);
  });

  it("sends the correct request body and returns content", async () => {
    vi.stubEnv("LLM_BASE_URL", "https://9router.example.com/v1");
    vi.stubEnv("LLM_MODEL", "ollama/gpt-oss:120b");
    vi.stubEnv("LLM_API_KEY", "sk-test");

    const fakeContent = "Hello from fallback";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ choices: [{ message: { content: fakeContent } }] }))
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateOutputViaFallbackLlm("linkedin_post", "Test transcript");
    expect(result).toBe(fakeContent);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://9router.example.com/v1/chat/completions");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Authorization"]).toBe("Bearer sk-test");
    expect(opts.headers["X-Title"]).toBe("VervAI");

    const body = JSON.parse(opts.body);
    expect(body.model).toBe("ollama/gpt-oss:120b");
    expect(body.stream).toBe(false);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toMatchObject({ role: "system", content: "system-prompt" });
    expect(body.messages[1].content).toContain("Test transcript");
  });

  it("truncates transcript to 15000 characters", async () => {
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_BASE_URL", "https://example.com/v1");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ choices: [{ message: { content: "ok" } }] }))
    });
    vi.stubGlobal("fetch", fetchMock);

    const longTranscript = "x".repeat(20_000);
    await generateOutputViaFallbackLlm("linkedin_post", longTranscript);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1].content).toContain("x".repeat(15_000));
    expect(body.messages[1].content).toHaveLength(15_000 + "Transcript:\n\n".length);
  });

  it("throws on non-OK status", async () => {
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_BASE_URL", "https://example.com/v1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, text: () => "unavailable" }));

    await expect(
      generateOutputViaFallbackLlm("linkedin_post", "data")
    ).rejects.toThrow(/503/);
  });

  it("throws on missing content in response", async () => {
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_BASE_URL", "https://example.com/v1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ choices: [] }))
    }));

    await expect(
      generateOutputViaFallbackLlm("linkedin_post", "data")
    ).rejects.toThrow(/no content/);
  });

  it("tolerates SSE-streamed responses even when stream:false is ignored", async () => {
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_BASE_URL", "https://example.com/v1");
    const chunks = [
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "thinking hard" } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Final" } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}`,
      "data: [DONE]"
    ].join("\n\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => chunks }));

    const result = await generateOutputViaFallbackLlm("linkedin_post", "data");
    expect(result).toBe("Final");
  });

  it("returns content when the SSE final chunk carries a message (non-delta shape)", async () => {
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_BASE_URL", "https://example.com/v1");
    const chunks = `data: ${JSON.stringify({ choices: [{ message: { content: "via-message" } }] })}\n\ndata: [DONE]`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => chunks }));

    const result = await generateOutputViaFallbackLlm("linkedin_post", "data");
    expect(result).toBe("via-message");
  });

  it("throws on an SSE response with no content chunk", async () => {
    vi.stubEnv("LLM_API_KEY", "sk-test");
    vi.stubEnv("LLM_BASE_URL", "https://example.com/v1");
    const chunks = `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "still thinking" } }] })}\n\ndata: [DONE]`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => chunks }));

    await expect(
      generateOutputViaFallbackLlm("linkedin_post", "data")
    ).rejects.toThrow(/no content/);
  });
});