import { describe, expect, it } from "vitest";

import { readAgentSkillContent, sha256Hex } from "@/lib/agent-skills";
import { GET } from "../route";

describe("GET /.well-known/agent-skills/index.json", () => {
  it("publishes the canonical affiliate and advertiser skills", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(body.$schema).toBe(
      "https://agentskills.io/schemas/agent-skills-index/v0.2.0.json"
    );
    expect(body.publisher).toEqual({
      name: "AffiliateSwarm",
      url: "https://affiliateswarm.ai",
    });
    expect(body.skills).toHaveLength(2);

    expect(body.skills.map((skill: { name: string }) => skill.name)).toEqual([
      "swarm-affiliate",
      "swarm-advertiser",
    ]);
    expect(body.skills.map((skill: { url: string }) => skill.url)).toEqual([
      "https://affiliateswarm.ai/affiliate/skill.md",
      "https://affiliateswarm.ai/advertiser/skill.md",
    ]);
    expect(body.skills.map((skill: { url: string }) => skill.url)).not.toContain(
      "https://affiliateswarm.ai/skill.md"
    );
  });

  it("hashes the exact skill markdown files", async () => {
    const res = await GET();
    const body = await res.json();
    const skills = Object.fromEntries(
      body.skills.map((skill: { name: string; sha256: string }) => [
        skill.name,
        skill.sha256,
      ])
    );

    expect(skills["swarm-affiliate"]).toBe(
      sha256Hex(readAgentSkillContent("affiliate"))
    );
    expect(skills["swarm-advertiser"]).toBe(
      sha256Hex(readAgentSkillContent("advertiser"))
    );
    expect(skills["swarm-affiliate"]).toMatch(/^[a-f0-9]{64}$/);
    expect(skills["swarm-advertiser"]).toMatch(/^[a-f0-9]{64}$/);
  });
});
