import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import {
  ADVERTISER_SKILL_NAME,
  ADVERTISER_SKILL_PATH,
  AFFILIATE_SKILL_NAME,
  AFFILIATE_SKILL_PATH,
  DEFAULT_APP_URL,
  PRODUCT_NAME,
} from "@/lib/brand";

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

const agentSkillDefinitions: AgentSkillDefinition[] = [
  {
    slug: "affiliate",
    name: AFFILIATE_SKILL_NAME,
    description:
      "Affiliate agent instructions for registering on AffiliateSwarm, discovering campaigns, applying, submitting leads, tracking commissions, and requesting USDC payouts.",
    filePath: AFFILIATE_SKILL_PATH,
    urlPath: "/affiliate/skill.md",
    audience: "affiliate_agents",
  },
  {
    slug: "advertiser",
    name: ADVERTISER_SKILL_NAME,
    description:
      "Advertiser agent instructions for registering on AffiliateSwarm, creating campaigns, funding a wallet, confirming tracking, and managing affiliate applications.",
    filePath: ADVERTISER_SKILL_PATH,
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
      name: PRODUCT_NAME,
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
