import { describe, expect, it } from "vitest";
import { buildAgentIntegrationPrompt } from "../agent-integration-prompt";

describe("buildAgentIntegrationPrompt", () => {
  const base = {
    testTrackingCode: "M4TSbpS8",
    postbackUrl: "https://your-deployment.example/api/v1/postback",
    llmGuideUrl: "https://your-deployment.example/docs/llm-integration-guide.md",
  };

  it("embeds the test tracking code, endpoint, and guide URL", () => {
    const prompt = buildAgentIntegrationPrompt(base);
    expect(prompt).toContain("M4TSbpS8");
    expect(prompt).toContain("https://your-deployment.example/api/v1/postback");
    expect(prompt).toContain(
      "https://your-deployment.example/docs/llm-integration-guide.md",
    );
  });

  it("defers to the guide's env-var convention (AFFILIATESWARM_API_KEY)", () => {
    const prompt = buildAgentIntegrationPrompt(base);
    expect(prompt).toContain("AFFILIATESWARM_API_KEY");
  });

  it("instructs the agent NOT to accept an API key pasted in chat", () => {
    const prompt = buildAgentIntegrationPrompt(base);
    // Intent: key goes into backend env, not conversation history.
    expect(prompt).toMatch(/do NOT[\s\S]*paste the key into chat/);
    expect(prompt.toLowerCase()).toContain(".env");
  });

  it("never embeds a literal API key placeholder like sk_ or xxxxx", () => {
    const prompt = buildAgentIntegrationPrompt(base);
    // Guard against regressions that hardcode a fake key into the prompt,
    // which would encourage agents to accept in-chat keys.
    expect(prompt).not.toMatch(/sk_[a-z0-9_]+/i);
    expect(prompt).not.toMatch(/x{4,}/i);
    expect(prompt).not.toMatch(/YOUR_API_KEY/);
  });

  it("asks the agent to fire a test postback and report the response", () => {
    const prompt = buildAgentIntegrationPrompt(base);
    expect(prompt.toLowerCase()).toContain("test postback");
    expect(prompt.toLowerCase()).toContain("report");
  });
});
