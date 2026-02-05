import dotenv from 'dotenv';
import { createAgent } from './agent';

// Load environment variables
dotenv.config();

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Venice.AI Affiliate Agent                             ║
║     Starting up...                                        ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Check for Venice API key (optional in stub mode)
  if (!process.env.VENICE_API_KEY) {
    console.log('[Main] No VENICE_API_KEY found - running in full stub mode');
  }

  // Create agent
  const agent = createAgent({
    name: process.env.AGENT_NAME || 'venice-affiliate-agent',
    description:
      process.env.AGENT_DESCRIPTION ||
      'AI agent promoting Venice.AI products on Twitter',
    dryRun: process.env.DRY_RUN === 'true',
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Main] Received SIGINT, shutting down...');
    agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[Main] Received SIGTERM, shutting down...');
    agent.stop();
    process.exit(0);
  });

  try {
    // Initialize agent
    await agent.initialize();

    // Run agent
    await agent.run();
  } catch (error) {
    console.error('[Main] Fatal error:', error);
    process.exit(1);
  }
}

main();
