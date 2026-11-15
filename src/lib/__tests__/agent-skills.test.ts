import { describe, expect, it } from "vitest";

import { DEFAULT_APP_URL } from "@/lib/brand";
import {
  readAgentSkillContent,
  renderAgentSkillContent,
  sha256Hex,
} from "@/lib/agent-skills";

describe("renderAgentSkillContent", () => {
  it("leaves the checked-in placeholder in place when no deployment URL is set", () => {
    const raw = readAgentSkillContent("affiliate");
    expect(raw).toContain(DEFAULT_APP_URL);
    expect(renderAgentSkillContent("affiliate")).toBe(raw);
    expect(sha256Hex(renderAgentSkillContent("affiliate"))).toBe(sha256Hex(raw));
  });

  it("rewrites the placeholder origin and the credential-scope host", () => {
    const rendered = renderAgentSkillContent(
      "affiliate",
      "https://swarm.operator.example/"
    );

    expect(rendered).toContain("https://swarm.operator.example/api/v1");
    expect(rendered).not.toContain(DEFAULT_APP_URL);
    expect(rendered).not.toContain("your-deployment.example");
    expect(rendered).toContain("swarm.operator.example");
  });

  it("rewrites the advertiser skill the same way", () => {
    const rendered = renderAgentSkillContent(
      "advertiser",
      "http://localhost:3000"
    );
    expect(rendered).toContain("http://localhost:3000/api/v1");
    expect(rendered).not.toContain("your-deployment.example");
  });
});
