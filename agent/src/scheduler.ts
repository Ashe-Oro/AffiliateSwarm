// Rate limiting and scheduling utilities

export interface RateLimitConfig {
  minDelayMs: number; // Minimum delay between actions
  maxPostsPerHour: number;
  maxRepliesPerHour: number;
  variancePercent: number; // Add randomness to delays
}

export const DEFAULT_CONFIG: RateLimitConfig = {
  minDelayMs: 30000, // 30 seconds minimum between any action
  maxPostsPerHour: 2,
  maxRepliesPerHour: 10,
  variancePercent: 30,
};

export class Scheduler {
  private config: RateLimitConfig;
  private lastActionTime = 0;
  private postsThisHour = 0;
  private repliesThisHour = 0;
  private hourStart = Date.now();

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private resetHourlyCountsIfNeeded(): void {
    const now = Date.now();
    if (now - this.hourStart >= 3600000) {
      // 1 hour
      this.postsThisHour = 0;
      this.repliesThisHour = 0;
      this.hourStart = now;
    }
  }

  private addVariance(delayMs: number): number {
    const variance = delayMs * (this.config.variancePercent / 100);
    const randomVariance = (Math.random() - 0.5) * 2 * variance;
    return Math.max(delayMs + randomVariance, this.config.minDelayMs);
  }

  canPost(): boolean {
    this.resetHourlyCountsIfNeeded();
    return this.postsThisHour < this.config.maxPostsPerHour;
  }

  canReply(): boolean {
    this.resetHourlyCountsIfNeeded();
    return this.repliesThisHour < this.config.maxRepliesPerHour;
  }

  async waitForNextAction(): Promise<void> {
    const now = Date.now();
    const timeSinceLastAction = now - this.lastActionTime;

    if (timeSinceLastAction < this.config.minDelayMs) {
      const waitTime = this.addVariance(
        this.config.minDelayMs - timeSinceLastAction
      );
      console.log(
        `[Scheduler] Waiting ${Math.round(waitTime / 1000)}s before next action...`
      );
      await this.sleep(waitTime);
    }
  }

  recordPost(): void {
    this.resetHourlyCountsIfNeeded();
    this.postsThisHour++;
    this.lastActionTime = Date.now();
    console.log(
      `[Scheduler] Post recorded (${this.postsThisHour}/${this.config.maxPostsPerHour} this hour)`
    );
  }

  recordReply(): void {
    this.resetHourlyCountsIfNeeded();
    this.repliesThisHour++;
    this.lastActionTime = Date.now();
    console.log(
      `[Scheduler] Reply recorded (${this.repliesThisHour}/${this.config.maxRepliesPerHour} this hour)`
    );
  }

  getStats(): {
    postsThisHour: number;
    repliesThisHour: number;
    maxPosts: number;
    maxReplies: number;
  } {
    this.resetHourlyCountsIfNeeded();
    return {
      postsThisHour: this.postsThisHour,
      repliesThisHour: this.repliesThisHour,
      maxPosts: this.config.maxPostsPerHour,
      maxReplies: this.config.maxRepliesPerHour,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Utility function for random delays
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Utility function for exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(
          `[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
