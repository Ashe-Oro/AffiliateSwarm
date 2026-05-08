import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

export const AGENT_SKILLS_INDEX_SCHEMA =
  "https://agentskills.io/schemas/agent-skills-index/v0.2.0.json";

export type AgentSkillSlug = "affiliate" | "advertiser";

type AgentSkillDefinition = {
  slug: AgentSkillSlug;
  name: string;
  description: string;
  filePath: string;
  urlPath: string;
  audience: string;
};

const DEFAULT_APP_URL = "https://regatta.network";

const agentSkillDefinitions: AgentSkillDefinition[] = [
  {
    slug: "affiliate",
    name: "regatta-affiliate",
    description:
      "Affiliate agent instructions for registering on Regatta, discovering campaigns, applying, submitting leads, tracking commissions, and requesting USDC payouts.",
    filePath: "skills/regatta-affiliate/SKILL.md",
    urlPath: "/affiliate/skill.md",
    audience: "affiliate_agents",
  },
  {
    slug: "advertiser",
    name: "regatta-advertiser",
    description:
      "Advertiser agent instructions for registering on Regatta, creating campaigns, funding a wallet, confirming tracking, and managing affiliate applications.",
    filePath: "skills/regatta-advertiser/SKILL.md",
    urlPath: "/advertiser/skill.md",
    audience: "advertiser_agents",
  },
];

const skillContentCache = new Map<AgentSkillSlug, string>();

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function getDefinition(slug: AgentSkillSlug): AgentSkillDefinition {
  const definition = agentSkillDefinitions.find((skill) => skill.slug === slug);
  if (!definition) {
    throw new Error(`Unknown agent skill: ${slug}`);
  }
  return definition;
}

export function listAgentSkillDefinitions(): AgentSkillDefinition[] {
  return agentSkillDefinitions.map((skill) => ({ ...skill }));
}

export function readAgentSkillContent(slug: AgentSkillSlug): string {
  const cached = skillContentCache.get(slug);
  if (cached) return cached;

  const definition = getDefinition(slug);
  const content = readFileSync(join(process.cwd(), definition.filePath), "utf-8");
  skillContentCache.set(slug, content);
  return content;
}

export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function getAgentSkillsIndex(baseUrl = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    $schema: AGENT_SKILLS_INDEX_SCHEMA,
    publisher: {
      name: "Regatta",
      url: normalizedBaseUrl,
    },
    skills: agentSkillDefinitions.map((definition) => {
      const content = readAgentSkillContent(definition.slug);

      return {
        name: definition.name,
        type: "skill",
        description: definition.description,
        url: `${normalizedBaseUrl}${definition.urlPath}`,
        content_type: "text/markdown; charset=utf-8",
        sha256: sha256Hex(content),
        audience: definition.audience,
      };
    }),
  };
}
