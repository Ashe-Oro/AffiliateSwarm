/**
 * Skill-driven e2e — proves a real LLM agent can read each SKILL.md file and
 * register itself on AffiliateSwarm via the API. If an agent reads the
 * advertiser or affiliate skill and follows it, does registration work?
 *
 * Skipped unless ANTHROPIC_API_KEY is set. Costs API credits per run.
 *
 * For each role we:
 *  1. Spin up a Claude conversation with the skill file as system prompt.
 *  2. Tell the agent the platform URL is local (overriding the skill's
 *     production URL) and provide the email/displayName the human "approved".
 *  3. Hand it a single `http_request` tool that hits localhost.
 *  4. Loop tool calls until the agent stops.
 *  5. Assert: the agent created an account that we can reach via /api/v1/me.
 */

import { test, expect } from "@playwright/test";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;
const BASE_URL = process.env.BASE_URL || "http://localhost:3099";
const MODEL = process.env.SKILL_TEST_MODEL || "claude-sonnet-4-5";
const MAX_TURNS = 25;
const RUN_ID = Date.now();

test.describe.configure({ mode: "serial" });
test.skip(!HAS_KEY, "Skill-agent e2e requires ANTHROPIC_API_KEY");

interface AllowedHost {
  origin: string;
}

function isAllowedUrl(url: string, allowed: AllowedHost[]): boolean {
  try {
    const parsed = new URL(url);
    return allowed.some((a) => parsed.origin === a.origin);
  } catch {
    return false;
  }
}

interface ToolCallLog {
  request: { method: string; url: string; body?: unknown };
  response: { status: number; body: unknown };
}

async function runAgentSession(opts: {
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ toolCalls: ToolCallLog[]; finalText: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const allowed: AllowedHost[] = [{ origin: new URL(BASE_URL).origin }];
  const toolCalls: ToolCallLog[] = [];

  const tools: Anthropic.Tool[] = [
    {
      name: "http_request",
      description:
        "Make an HTTP request to the AffiliateSwarm platform API. Returns the response status code and JSON body.",
      input_schema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST", "PATCH", "DELETE"] },
          url: { type: "string", description: "Full URL of the endpoint" },
          headers: {
            type: "object",
            additionalProperties: { type: "string" },
            description: "Optional request headers (e.g. Authorization)",
          },
          body: {
            type: "object",
            description: "Optional JSON body for POST/PATCH",
          },
        },
        required: ["method", "url"],
      },
    },
  ];

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: opts.userPrompt },
  ];

  let finalText = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: opts.systemPrompt,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: resp.content });

    const textBlocks = resp.content.filter((b) => b.type === "text");
    if (textBlocks.length > 0) {
      finalText = textBlocks
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n");
    }

    if (resp.stop_reason === "end_turn") {
      return { toolCalls, finalText };
    }

    const toolUses = resp.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) {
      // Stopped for some other reason (max_tokens, refusal, etc.)
      return { toolCalls, finalText };
    }

    const toolResults: Anthropic.MessageParam = {
      role: "user",
      content: toolUses.map((tu) => {
        if (tu.type !== "tool_use") {
          return { type: "tool_result" as const, tool_use_id: "", content: "" };
        }
        const input = tu.input as {
          method: string;
          url: string;
          headers?: Record<string, string>;
          body?: unknown;
        };

        if (!isAllowedUrl(input.url, allowed)) {
          return {
            type: "tool_result" as const,
            tool_use_id: tu.id,
            is_error: true,
            content: `URL not allowed in this test sandbox: ${input.url}. Use ${BASE_URL} instead.`,
          };
        }

        return { type: "tool_result" as const, tool_use_id: tu.id, content: "PENDING" };
      }),
    };

    // Execute the calls and replace PENDING placeholders with real results.
    for (let i = 0; i < toolUses.length; i++) {
      const tu = toolUses[i];
      if (tu.type !== "tool_use") continue;
      const input = tu.input as {
        method: string;
        url: string;
        headers?: Record<string, string>;
        body?: unknown;
      };
      if (!isAllowedUrl(input.url, allowed)) continue;

      const headers = {
        "Content-Type": "application/json",
        ...(input.headers ?? {}),
      };
      const fetchInit: RequestInit = {
        method: input.method,
        headers,
        ...(input.body !== undefined && input.method !== "GET"
          ? { body: JSON.stringify(input.body) }
          : {}),
      };
      const res = await fetch(input.url, fetchInit);
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      toolCalls.push({
        request: { method: input.method, url: input.url, body: input.body },
        response: { status: res.status, body: parsed },
      });

      const content = toolResults.content;
      if (Array.isArray(content)) {
        const slot = content[i];
        if (slot && slot.type === "tool_result") {
          slot.content = JSON.stringify({ status: res.status, body: parsed });
        }
      }
    }

    messages.push(toolResults);
  }

  return { toolCalls, finalText };
}

function findRegistrationResponse(
  toolCalls: ToolCallLog[]
): { agentId?: string; apiKey?: string } | null {
  for (const call of toolCalls) {
    if (
      call.request.method === "POST" &&
      call.request.url.includes("/api/v1/agents") &&
      !call.request.url.includes("/applications") &&
      call.response.status === 201
    ) {
      const body = call.response.body as
        | { data?: { agent?: { id?: string }; apiKey?: string } }
        | undefined;
      return {
        agentId: body?.data?.agent?.id,
        apiKey: body?.data?.apiKey,
      };
    }
  }
  return null;
}

async function verifyAgentExists(apiKey: string): Promise<{
  id: string;
  displayName: string;
  type: string;
}> {
  const res = await fetch(`${BASE_URL}/api/v1/me`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  expect(res.status, "GET /api/v1/me with returned key should succeed").toBe(200);
  const body = (await res.json()) as {
    data: { agent: { id: string; displayName: string; type: string } };
  };
  return body.data.agent;
}

// ═══════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════

test("advertiser skill — agent reads SKILL.md and registers via API", async () => {
  test.setTimeout(180_000);

  const skill = readFileSync(
    join(process.cwd(), "skills/swarm-advertiser/SKILL.md"),
    "utf-8"
  );

  const email = `skill-adv-${RUN_ID}@test.affiliateswarm.dev`;
  const displayName = `Skill-Test Advertiser ${RUN_ID}`;

  const userPrompt = `Your human has approved the registration. Use these values:
- email: ${email}
- displayName: ${displayName}
- description: AI productivity tools for individual users.

IMPORTANT: For this run the platform is reachable at ${BASE_URL} (NOT your-deployment.example). Substitute that host for every API call you make.

You do NOT have a filesystem in this sandbox — skip any "save credentials to ~/.config/affiliateswarm/credentials.json" step. Just register and report the resulting agentId + apiKey to me when done.`;

  const result = await runAgentSession({
    systemPrompt: skill,
    userPrompt,
  });

  const reg = findRegistrationResponse(result.toolCalls);
  expect(reg, `agent should have called POST /api/v1/agents successfully. Final: ${result.finalText}`).not.toBeNull();
  expect(reg!.apiKey).toMatch(/^swarm_live_/);

  const agent = await verifyAgentExists(reg!.apiKey!);
  expect(agent.displayName).toBe(displayName);
  expect(agent.type).toBe("ADVERTISER");
});

test("affiliate skill — agent reads SKILL.md and registers via API", async () => {
  test.setTimeout(180_000);

  const skill = readFileSync(
    join(process.cwd(), "skills/swarm-affiliate/SKILL.md"),
    "utf-8"
  );

  const email = `skill-aff-${RUN_ID}@test.affiliateswarm.dev`;
  const displayName = `Skill-Test Affiliate ${RUN_ID}`;

  const userPrompt = `Your human has approved the registration. Use these values:
- email: ${email}
- displayName: ${displayName}
- description: AI tool reviews and tutorials for developers.
- audienceSize: 5000
- channels: ["blog", "twitter"]
- contentType: review
- audienceGeo: US

IMPORTANT: For this run the platform is reachable at ${BASE_URL} (NOT your-deployment.example). Substitute that host for every API call you make.

You do NOT have a filesystem in this sandbox — skip any "save credentials to ~/.config/affiliateswarm/credentials.json" step. Just register and report the resulting agentId + apiKey to me when done.`;

  const result = await runAgentSession({
    systemPrompt: skill,
    userPrompt,
  });

  const reg = findRegistrationResponse(result.toolCalls);
  expect(reg, `agent should have called POST /api/v1/agents successfully. Final: ${result.finalText}`).not.toBeNull();
  expect(reg!.apiKey).toMatch(/^swarm_live_/);

  const agent = await verifyAgentExists(reg!.apiKey!);
  expect(agent.displayName).toBe(displayName);
  expect(agent.type).toBe("AFFILIATE");
});
