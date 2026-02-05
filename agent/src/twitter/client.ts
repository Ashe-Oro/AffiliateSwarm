// Stubbed Twitter client for development/testing

export interface TwitterConfig {
  username: string;
  mockMode?: boolean;
}

export interface Tweet {
  id?: string;
  text?: string;
  username?: string;
  name?: string;
  timeParsed?: Date;
}

export class TwitterClient {
  private config: TwitterConfig;
  private isInitialized = false;
  private mockTweetCounter = 0;

  constructor(config: TwitterConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[Twitter] Initializing in STUB mode (no real Twitter connection)');
    this.isInitialized = true;
  }

  async searchTweets(query: string, maxTweets = 20): Promise<Tweet[]> {
    await this.initialize();

    // Generate mock tweets for testing
    const mockTweets: Tweet[] = [
      {
        id: `mock_${Date.now()}_1`,
        text: `Anyone know a good AI that respects privacy? Tired of my data being harvested. #AIPrivacy`,
        username: 'privacy_advocate',
        name: 'Privacy First',
        timeParsed: new Date(),
      },
      {
        id: `mock_${Date.now()}_2`,
        text: `Looking for an uncensored AI for my creative writing project. ChatGPT keeps blocking everything.`,
        username: 'creative_writer',
        name: 'Alex Writer',
        timeParsed: new Date(),
      },
      {
        id: `mock_${Date.now()}_3`,
        text: `Need an AI API that doesn't log my requests. Building something sensitive.`,
        username: 'dev_builder',
        name: 'Dev Builder',
        timeParsed: new Date(),
      },
      {
        id: `mock_${Date.now()}_4`,
        text: `The weather is nice today! Going for a walk.`,
        username: 'random_user',
        name: 'Random Person',
        timeParsed: new Date(),
      },
      {
        id: `mock_${Date.now()}_5`,
        text: `Is there a crypto-native AI platform? Would love to pay with ETH.`,
        username: 'crypto_fan',
        name: 'Crypto Enthusiast',
        timeParsed: new Date(),
      },
    ];

    const results = mockTweets.slice(0, Math.min(maxTweets, mockTweets.length));
    console.log(`[Twitter] STUB: Found ${results.length} mock tweets for query: "${query}"`);

    return results;
  }

  async postTweet(content: string): Promise<{ success: boolean; tweetId?: string }> {
    await this.initialize();

    this.mockTweetCounter++;
    const mockId = `mock_post_${this.mockTweetCounter}`;

    console.log(`[Twitter] STUB: Would post tweet: "${content}"`);
    console.log(`[Twitter] STUB: Mock tweet ID: ${mockId}`);

    return { success: true, tweetId: mockId };
  }

  async replyToTweet(
    tweetId: string,
    content: string
  ): Promise<{ success: boolean; replyId?: string }> {
    await this.initialize();

    this.mockTweetCounter++;
    const mockId = `mock_reply_${this.mockTweetCounter}`;

    console.log(`[Twitter] STUB: Would reply to ${tweetId}: "${content}"`);
    console.log(`[Twitter] STUB: Mock reply ID: ${mockId}`);

    return { success: true, replyId: mockId };
  }

  async getTweet(tweetId: string): Promise<Tweet | null> {
    await this.initialize();

    console.log(`[Twitter] STUB: Would fetch tweet ${tweetId}`);

    return {
      id: tweetId,
      text: 'This is a mock tweet for testing purposes.',
      username: 'mock_user',
      name: 'Mock User',
      timeParsed: new Date(),
    };
  }

  async getMyProfile(): Promise<{ username: string; name: string } | null> {
    await this.initialize();

    return {
      username: this.config.username,
      name: `${this.config.username} (stub)`,
    };
  }
}

export function createTwitterClient(): TwitterClient {
  const username = process.env.TWITTER_USERNAME || 'venice_affiliate_bot';

  console.log('[Twitter] Creating STUBBED Twitter client (no real API calls)');

  return new TwitterClient({
    username,
    mockMode: true,
  });
}
