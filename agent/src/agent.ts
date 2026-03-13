import { TwitterClient, createTwitterClient } from './twitter/client';
import { VeniceClient, createVeniceClient } from './venice/client';
import { PlatformClient, createPlatformClient } from './platform-client';
import { Scheduler, randomDelay } from './scheduler';
import { SEARCH_QUERIES } from './venice/prompts';
import type { Tweet } from 'agent-twitter-client';

export interface AgentConfig {
  name: string;
  description: string;
  dryRun?: boolean; // If true, don't actually post (for testing)
  enablePlatformCheckIn?: boolean;
  enablePlatformActivityLogging?: boolean;
  enableTwitterPosting?: boolean;
}

export class VeniceAffiliateAgent {
  private twitter: TwitterClient;
  private venice: VeniceClient;
  private platform: PlatformClient;
  private scheduler: Scheduler;
  private config: AgentConfig;
  private skillContent: string = '';
  private isRunning = false;
  private processedTweetIds = new Set<string>();
  private enablePlatformCheckIn: boolean;
  private enablePlatformActivityLogging: boolean;
  private enableTwitterPosting: boolean;

  constructor(config: AgentConfig) {
    this.config = config;
    this.twitter = createTwitterClient();
    this.venice = createVeniceClient();
    this.platform = createPlatformClient();
    this.scheduler = new Scheduler();
    this.enablePlatformCheckIn = config.enablePlatformCheckIn ?? false;
    this.enablePlatformActivityLogging = config.enablePlatformActivityLogging ?? false;
    this.enableTwitterPosting = config.enableTwitterPosting ?? false;
  }

  async initialize(): Promise<void> {
    console.log(`[Agent] Initializing ${this.config.name}...`);

    // Initialize Twitter client
    await this.twitter.initialize();

    // Register with platform
    const registration = await this.platform.register(
      this.config.name,
      this.config.description
    );
    console.log(`[Agent] Registered with affiliate ID: ${registration.affiliateId}`);

    // Fetch skill.md
    await this.refreshSkill();

    console.log('[Agent] Initialization complete');
  }

  async refreshSkill(): Promise<void> {
    try {
      const skill = await this.platform.getSkill();
      this.skillContent = skill.content;
      console.log(`[Agent] Loaded skill.md (version: ${skill.version})`);
    } catch (error) {
      console.error('[Agent] Failed to fetch skill:', error);
    }
  }

  async run(): Promise<void> {
    this.isRunning = true;
    console.log('[Agent] Starting main loop...');

    while (this.isRunning) {
      try {
        // Check in with platform
        await this.sendCheckIn();

        // Check for skill updates
        await this.checkSkillUpdates();

        // Search and engage
        await this.searchAndEngage();

        // Maybe post original content
        await this.maybePostOriginal();

        // Wait before next cycle
        await randomDelay(60000, 120000); // 1-2 minutes
      } catch (error) {
        console.error('[Agent] Error in main loop:', error);
        await randomDelay(30000, 60000); // Wait 30-60s on error
      }
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log('[Agent] Stopping...');
  }

  private async sendCheckIn(): Promise<void> {
    if (!this.enablePlatformCheckIn) {
      return;
    }

    try {
      const stats = this.scheduler.getStats();
      await this.platform.checkIn('running', {
        postsToday: stats.postsThisHour,
        repliesToday: stats.repliesThisHour,
        lastActivity: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Agent] Check-in failed:', error);
    }
  }

  private async checkSkillUpdates(): Promise<void> {
    try {
      const version = await this.platform.getSkillVersion();
      // For now, just refresh periodically
      // In production, compare versions and refresh only if changed
      console.log(`[Agent] Current skill version: ${version.version}`);
    } catch (error) {
      console.error('[Agent] Failed to check skill version:', error);
    }
  }

  private async logPlatformActivity(
    type: 'post' | 'reply' | 'like' | 'retweet' | 'search',
    platform: 'twitter' | 'discord' | 'other',
    content?: string,
    targetId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.enablePlatformActivityLogging) {
      return;
    }

    try {
      await this.platform.logActivity(type, platform, content, targetId, metadata);
    } catch (error) {
      console.error('[Agent] Activity log failed:', error);
    }
  }

  private async searchAndEngage(): Promise<void> {
    if (!this.scheduler.canReply()) {
      console.log('[Agent] Reply limit reached, skipping search...');
      return;
    }

    // Pick a random search query
    const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
    console.log(`[Agent] Searching for: "${query}"`);

    // Log search activity
    await this.logPlatformActivity('search', 'twitter', query);

    const tweets = await this.twitter.searchTweets(query, 10);

    for (const tweet of tweets) {
      if (!this.scheduler.canReply()) break;
      if (this.processedTweetIds.has(tweet.id || '')) continue;

      await this.evaluateAndEngage(tweet);
      this.processedTweetIds.add(tweet.id || '');

      // Clean up old processed IDs (keep last 1000)
      if (this.processedTweetIds.size > 1000) {
        const arr = Array.from(this.processedTweetIds);
        this.processedTweetIds = new Set(arr.slice(-500));
      }
    }
  }

  private async evaluateAndEngage(tweet: Tweet): Promise<void> {
    const tweetText = tweet.text || '';
    const author = tweet.username || 'unknown';
    const tweetId = tweet.id;

    if (!tweetId) return;

    console.log(`[Agent] Evaluating tweet from @${author}: "${tweetText.slice(0, 50)}..."`);

    // Use Venice to evaluate if we should engage
    const evaluation = await this.venice.evaluateEngagement(tweetText, author);

    if (!evaluation.shouldEngage) {
      console.log(`[Agent] Skipping - ${evaluation.reason}`);
      return;
    }

    console.log(`[Agent] Engaging - ${evaluation.reason}`);

    // Generate or use suggested reply
    let replyContent = evaluation.suggestedReply;
    if (!replyContent) {
      replyContent = await this.venice.generateReply(tweetText);
    }

    // Maybe append affiliate link if contextually appropriate
    if (replyContent.length < 220 && this.shouldIncludeLink(replyContent)) {
      replyContent += ` ${this.platform.getAffiliateLink()}`;
    }

    if (!this.enableTwitterPosting) {
      console.log('[Agent] Twitter posting disabled by feature flag, skipping reply');
      return;
    }

    // Wait for rate limit
    await this.scheduler.waitForNextAction();

    // Post reply
    if (this.config.dryRun) {
      console.log(`[Agent] DRY RUN - Would reply: "${replyContent}"`);
    } else {
      const result = await this.twitter.replyToTweet(tweetId, replyContent);
      if (result.success) {
        this.scheduler.recordReply();
        await this.logPlatformActivity(
          'reply',
          'twitter',
          replyContent,
          tweetId
        );
      }
    }
  }

  private async maybePostOriginal(): Promise<void> {
    if (!this.scheduler.canPost()) {
      return;
    }

    // 20% chance to post original content each cycle
    if (Math.random() > 0.2) {
      return;
    }

    console.log('[Agent] Generating original post...');

    const content = await this.venice.generateOriginalPost();

    // Maybe append affiliate link
    let finalContent = content;
    if (content.length < 220 && this.shouldIncludeLink(content)) {
      finalContent = `${content}\n\n${this.platform.getAffiliateLink()}`;
    }

    if (!this.enableTwitterPosting) {
      console.log('[Agent] Twitter posting disabled by feature flag, skipping original post');
      return;
    }

    await this.scheduler.waitForNextAction();

    if (this.config.dryRun) {
      console.log(`[Agent] DRY RUN - Would post: "${finalContent}"`);
    } else {
      const result = await this.twitter.postTweet(finalContent);
      if (result.success) {
        this.scheduler.recordPost();
        await this.logPlatformActivity('post', 'twitter', finalContent);
      }
    }
  }

  private shouldIncludeLink(content: string): boolean {
    // Include link if content mentions AI tools, privacy, or recommendations
    const linkTriggers = [
      'venice',
      'check out',
      'recommend',
      'try',
      'privacy',
      'api',
      'alternative',
    ];

    const lowerContent = content.toLowerCase();
    return linkTriggers.some((trigger) => lowerContent.includes(trigger));
  }
}

export function createAgent(config: AgentConfig): VeniceAffiliateAgent {
  return new VeniceAffiliateAgent(config);
}
