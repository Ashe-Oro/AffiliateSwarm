/**
 * Builds the self-contained prompt an advertiser pastes into their coding
 * agent to integrate Regatta conversion tracking. The agent follows the LLM
 * integration guide, uses the campaign's test tracking code, and asks the human
 * to place the API key directly into backend env/secrets — never into chat.
 */
export function buildAgentIntegrationPrompt(params: {
  testTrackingCode: string;
  postbackUrl: string;
  llmGuideUrl: string;
}): string {
  const { testTrackingCode, postbackUrl, llmGuideUrl } = params;
  return [
    `Integrate Regatta conversion tracking into this codebase,`,
    `following ${llmGuideUrl}.`,
    ``,
    `- Test tracking code: ${testTrackingCode}`,
    `- Endpoint: ${postbackUrl}`,
    `- API key: follow the guide's env-var convention (REGATTA_API_KEY).`,
    `  Ask me to set it in the backend's .env / secrets store — do NOT`,
    `  have me paste the key into chat.`,
    ``,
    `After implementing, fire one test postback and report the response.`,
  ].join("\n");
}
