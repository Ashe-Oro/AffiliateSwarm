// Venice.AI client - stubbed for development/testing

export interface VeniceConfig {
  apiKey?: string;
  stubMode?: boolean;
}

export interface GenerateOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export class VeniceClient {
  private stubMode: boolean;

  constructor(config: VeniceConfig) {
    this.stubMode = config.stubMode || !config.apiKey;

    if (this.stubMode) {
      console.log('[Venice] Running in STUB mode (no real API calls)');
    }
  }

  async generateResponse(
    prompt: string,
    _options: GenerateOptions = {}
  ): Promise<string> {
    console.log(`[Venice] STUB: generateResponse called with prompt: "${prompt.slice(0, 50)}..."`);

    // Return a mock response
    return 'This is a stubbed response from Venice AI.';
  }

  async evaluateEngagement(
    tweetContent: string,
    tweetAuthor: string
  ): Promise<{
    shouldEngage: boolean;
    reason: string;
    suggestedReply?: string;
  }> {
    console.log(`[Venice] STUB: Evaluating tweet from @${tweetAuthor}`);

    // Mock evaluation logic - engage with AI/privacy related tweets
    const keywords = ['ai', 'privacy', 'uncensored', 'api', 'chatgpt', 'alternative', 'crypto'];
    const lowerContent = tweetContent.toLowerCase();
    const isRelevant = keywords.some(kw => lowerContent.includes(kw));

    // Skip irrelevant tweets
    if (!isRelevant) {
      return {
        shouldEngage: false,
        reason: 'STUB: Tweet not relevant to AI/privacy topics',
      };
    }

    // Generate mock suggested replies based on content
    let suggestedReply = '';
    if (lowerContent.includes('privacy')) {
      suggestedReply = "Privacy in AI is crucial! There are platforms now that don't log or retain your data at all. Worth exploring if that matters to you.";
    } else if (lowerContent.includes('uncensored') || lowerContent.includes('creative')) {
      suggestedReply = "For creative work, open-source models give you way more freedom. No arbitrary content blocks getting in the way.";
    } else if (lowerContent.includes('api')) {
      suggestedReply = "If you need a privacy-respecting API, there are OpenAI-compatible options that don't log requests. Great for sensitive projects.";
    } else if (lowerContent.includes('crypto')) {
      suggestedReply = "Crypto-native AI platforms are emerging! Pay with ETH, stake tokens, full Web3 integration. Exciting times.";
    } else {
      suggestedReply = "Have you looked into privacy-first AI options? Some platforms now offer no data retention and uncensored models.";
    }

    return {
      shouldEngage: true,
      reason: 'STUB: Tweet matches AI/privacy keywords',
      suggestedReply,
    };
  }

  async generateOriginalPost(_topic?: string): Promise<string> {
    const mockPosts = [
      "Your AI conversations shouldn't be training data for someone else's model. Privacy-first AI is the future.",
      "Open-source AI models are getting incredibly good. No arbitrary restrictions, no mysterious content filters.",
      "Building with AI APIs? Consider what happens to your users' data. Not all providers are equal on privacy.",
      "The best AI tool is the one that respects your data. Full stop.",
      "Crypto + AI is a natural fit. Decentralized, private, permissionless. The future of intelligent systems.",
    ];

    const post = mockPosts[Math.floor(Math.random() * mockPosts.length)];
    console.log(`[Venice] STUB: Generated original post`);

    return post;
  }

  async generateReply(
    originalTweet: string,
    _context?: string
  ): Promise<string> {
    console.log(`[Venice] STUB: Generating reply to: "${originalTweet.slice(0, 50)}..."`);

    // Return contextual mock reply
    return "Great point! Privacy-respecting AI tools are becoming more accessible. Happy to share what I've found if you're interested.";
  }
}

export function createVeniceClient(): VeniceClient {
  const apiKey = process.env.VENICE_API_KEY;

  if (!apiKey || apiKey === 'test') {
    console.log('[Venice] Creating STUBBED Venice client (no real API calls)');
    return new VeniceClient({ stubMode: true });
  }

  return new VeniceClient({ apiKey });
}
