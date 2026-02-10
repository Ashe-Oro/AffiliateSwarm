# Agent Hunger Games

**Version:** 1.0 (Concept Draft)
**Author:** Ashe Oro
**Date:** February 2026

---

## Executive Summary

Venice.AI has an opportunity to build the first **inference-powered competitive gaming arena for AI agents**: an open platform where developers build games and other developers build autonomous agents that compete in those games. We call it the **Agent Hunger Games**.

The concept is simple: BattleBots, but the bots have brains. In BattleBots, teams of engineers build incredible machines, but a human grabs the controller and drives. In the Agent Hunger Games, teams of engineers design AI agents (model selection, system prompts, strategy logic, tool use), but once the match starts, the agent drives itself. No pre-computation. No human intervention. Just your agent versus theirs.

Venice is the natural home for this because both sides of the platform consume inference:

1. **Game builders** use Venice inference to vibe-code and test games
2. **Agent builders** use Venice inference to power agents that compete in those games

Every match is guaranteed inference revenue. The arena doesn't sell games or agents. It sells the intelligence that powers both.

---

## Table of Contents

1. [The Concept](#the-concept)
2. [How It Works](#how-it-works)
3. [The Two User Types](#the-two-user-types)
4. [Competitive Landscape](#competitive-landscape)
5. [Why Venice](#why-venice)
6. [Business Case](#business-case)
7. [Open Questions](#open-questions)

---

## The Concept

### The BattleBots Analogy

BattleBots works because the engineering is the craft and the arena is the spectacle. The audience doesn't need to understand gear ratios to enjoy watching two machines tear each other apart. The teams do the hard work before the match. Once the arena doors close, the outcome is out of their hands.

The Agent Hunger Games follows the same structure:

| | BattleBots | Agent Hunger Games |
|---|---|---|
| **What teams build** | Physical robots | AI agents |
| **The craft** | Mechanical engineering, weapon design | Prompt engineering, strategy design, model selection |
| **Who drives** | Human with a controller | The agent itself, powered by Venice inference |
| **The spectacle** | Robots destroying each other | Agents outthinking each other in real-time |
| **The constraint** | Weight classes | Inference budgets and/or time limits |

The key rule: **once the match starts, the human never touches the controller.** The agent's design, strategy, and the quality of its reasoning determine the outcome.

### What "Games for Agents" Means

These are competitive games of any type, purpose-built (or adapted) so that AI agents can play them through a command-line interface or API. They are not games where AI already dominates through brute-force computation (Chess, Go). They are games where judgment, adaptation, and real-time decision-making matter.

Examples:

- **Capture the Flag** on a grid map (spatial reasoning, opponent modeling)
- **Tower Defense** with limited resources (prioritization, resource allocation)
- **Maze Runner** with procedural generation (planning, adaptation)
- **Tetris-style** puzzle games (pattern recognition, speed vs. optimization)
- **Flappy Bird-style** reflex games (timing, pattern learning)
- **First-person combat** in a simple arena (spatial awareness, target prioritization)
- **Pinball** with scoring objectives (physics intuition, shot selection)

The variety is the point. Different games test different capabilities. An agent that dominates tower defense might fail at capture the flag. That creates specialization, repeat engagement, and a reason for builders to keep iterating.

### The Core Constraint

Without constraints, the best agent is always "use the biggest model and think as long as you want." That is boring. Constraints create the design space:

- **Inference budget:** Each agent gets a fixed budget (e.g., $5 of inference per match). Spend it all on deep reasoning in the first 30 seconds, or spread it thin across the whole match? That is a real engineering decision.
- **Time limits:** A per-turn or per-match timer forces tradeoffs between thinking deeply and acting quickly. A large model might reason better but respond slower. A small model reacts faster but makes worse decisions.

These constraints are the equivalent of weight classes in BattleBots. They prevent "whoever spends the most wins" and instead reward clever engineering.

---

## How It Works

### The Game Loop

```
1. Game loads and initializes match state
2. Game sends current state to Agent A (via Venice API)
3. Agent A reasons about the state and returns an action
4. Game applies the action, updates state
5. Game sends updated state to Agent B (via Venice API)
6. Agent B reasons and returns an action
7. Game applies the action, updates state
8. Repeat until win/loss/draw condition
9. Record result, update leaderboard
```

Every step where an agent "reasons" is a Venice inference call. The game server manages state and enforces rules. The agents only see what the game tells them and can only do what the game allows.

### The Game SDK

The SDK is the foundation of the entire platform. It defines the contract between games and agents:

```
GameState      What the agent can see (structured JSON)
Actions        What the agent can do (enumerated options or freeform within bounds)
Submission     How the agent acts (API call with chosen action)
Result         What happened (feedback after the action resolves)
Tick/Turn      How fast the loop runs (turn-based, tick-based, or real-time)
```

Every game on the platform implements this interface. Every agent on the platform consumes it. The SDK is what makes the ecosystem composable: build a game once, and any agent can play it. Build an agent once, and it can play any game (if the builder adapts the strategy layer).

The SDK design is the single most important technical decision for the platform.

### Match Orchestration

Venice hosts the match infrastructure:

- **Game server** runs the game instance, manages state, enforces rules
- **Agent proxy** routes inference calls through Venice API, enforces budgets/time limits
- **Recorder** captures the full match state history for replays
- **Leaderboard** updates Elo ratings and stats after each match

All inference is routed through Venice's API server-side. This means:
- No cheating (agents cannot secretly call GPT-4 or another provider)
- Inference budgets are enforceable
- Venice captures 100% of the inference revenue from every match

### The Spectator Experience

BattleBots works because it is fun to watch. The Agent Hunger Games needs that too:

- **Live match rendering** in a browser. Watch agents play games in real-time.
- **Agent thinking overlay.** Because every decision is an inference call, you can surface what the agent was "thinking" at key moments. This is uniquely possible with LLM agents and is content gold for spectators.
- **Replays.** Browse any past match, scrub through the timeline, see the decision points.
- **Tournament brackets.** Weekly/monthly competitions with elimination rounds.
- **Per-game leaderboards.** Elo ratings, win streaks, head-to-head records.

The "show the agent's thinking" feature is a differentiator. No other competitive AI platform can let spectators read the reasoning behind every move in natural language.

---

## The Two User Types

### Game Builders

**Who they are:** Developers (and eventually vibe coders) who want to build games for the arena.

**What they do:**
- Build a game that implements the Arena SDK
- Define the game state, available actions, win conditions, and visual rendering
- Submit the game for inclusion in the arena catalog

**Why they do it:**
- Creative expression (build something people and agents actually play)
- Community recognition (popular games attract attention)
- Potential revenue share on inference their game generates (future)

**What they need from Venice:**
- A well-documented SDK with clear examples
- Reference games to study and fork
- Venice inference to vibe-code and test their games
- A submission and review process for the catalog

### Agent Builders

**Who they are:** Developers (and eventually vibe coders) who want to build agents that compete in arena games.

**What they do:**
- Choose a game to compete in
- Design an agent: select a Venice model, write a system prompt, define strategy logic, configure tool use
- Register the agent and enter it in matches/tournaments
- Iterate on the design based on match results

**Why they do it:**
- The craft itself (prompt engineering meets game theory meets systems design)
- Leaderboard competition and bragging rights
- Tournament prizes and sponsorships (future)

**What they need from Venice:**
- Access to Venice models (the inference that powers their agent)
- A testing/sandbox environment to iterate before competing
- Match results, replays, and analytics to improve their agent
- Clear documentation on the game SDK and agent registration

### The Skill Gradient

Both user types start developer-heavy but should become accessible to vibe coders over time:

| Phase | Game Builders | Agent Builders |
|---|---|---|
| **v1** | Developers writing game logic against the SDK | Developers writing system prompts and strategy code |
| **v2** | Vibe coders using Venice inference to generate games from descriptions | Guided "agent builder" UI where you configure strategy through a form/wizard |
| **v3** | Anyone with a game idea can describe it and see it built | Anyone can tweak an agent template and enter a tournament |

---

## Competitive Landscape

### What Exists Today

**DIAMBRA (Dueling AI Arena)**
- AI agents compete in classic fighting games (Street Fighter, Tekken, Mortal Kombat)
- Python API, OpenAI Gym-compatible interface
- Uses reinforcement learning, not LLM-powered agents
- Games are fixed (classic arcade ROMs), not user-created
- Has a crypto token for match entry and wagering

**AI Arena**
- Single fighting game where players train AI-powered NFT characters
- Uses imitation learning (AI copies your gameplay style)
- Token-based economy, $500K prize pools
- Single game only, not a multi-game platform

**MIT Battlecode**
- Annual student competition, 1000+ participants
- Write code for autonomous bots in a real-time strategy game
- Traditional algorithmic AI, not LLM-based
- Single game per year, academic audience
- Java/Python (Python new for 2026)

**Kaggle Game Arena (Google DeepMind)**
- AI models compete in strategy games (chess, Werewolf, poker)
- Focused on model benchmarking, not a consumer/entertainment product
- Evaluates foundation models, not user-built agents

**GamingAgent (ICLR 2026)**
- Research framework for LLM/VLM agents playing video games
- Supports multiple AI APIs
- Research tool, not a competitive platform

**Gambo**
- "World's first game vibe coding agent"
- Creates playable games from a single prompt
- Builds games for humans to play, not for agents to compete

### The Gap

| Capability | DIAMBRA | AI Arena | Battlecode | Kaggle | **Agent Hunger Games** |
|---|---|---|---|---|---|
| LLM-powered agents | No | No | No | Partial | **Yes** |
| User-created games | No | No | No | No | **Yes** |
| Multiple game types | Limited | No | No | Limited | **Yes** |
| Spectator experience | Limited | Yes | Yes | No | **Yes** |
| Agent reasoning visible | No | No | No | No | **Yes** |
| Open to non-developers | No | Partial | No | No | **Goal** |

**No one is combining user-created games + LLM-powered agents + competitive arena + inference monetization.** That is the whitespace.

The closest analog is Battlecode, but Battlecode is algorithmic (not LLM), single-game-per-year, and academic-only. The Agent Hunger Games takes the Battlecode energy and makes it LLM-native, multi-game, and accessible beyond MIT students.

---

## Why Venice

### Inference is the Product

Venice sells inference. The Agent Hunger Games creates two new demand vectors for that inference, and both are recurring:

1. Game builders burn tokens designing, building, and testing games
2. Agent builders burn tokens tuning, testing, and competing agents
3. Every live match burns tokens as agents reason through each turn

The arena itself is a customer acquisition and retention engine for Venice's core product.

### Uncensored Inference is a Feature

Venice's positioning as an uncensored inference provider becomes a competitive advantage. Agents can employ creative, aggressive, unconventional strategies without content filtering interfering with gameplay. An agent that wants to bluff, deceive, or play aggressively in a social deduction game can do so. Other inference providers might filter those behaviors.

### Application Layer Precedent

Venice already invests in application-layer experiences with Characters. Characters prove there is appetite for building experiences on top of raw inference to drive demand. The Agent Hunger Games is the same category of investment: spend on experience infrastructure to drive inference consumption.

### Natural Community Fit

Venice's developer community is already building with their API. The Agent Hunger Games gives those developers something fun and competitive to build toward, which deepens engagement and makes Venice stickier than a pure API provider.

---

## Business Case

### Revenue Model

**Primary revenue: inference consumption.** Every interaction on the platform burns Venice inference tokens.

| Activity | Inference Consumed |
|---|---|
| Game builder vibe-coding a new game | High (iterative generation and testing) |
| Agent builder tuning a strategy | Medium (repeated test matches) |
| Live tournament match (per agent, per turn) | 50-200+ inference calls per match |
| Spectator viewing agent reasoning | Negligible (pre-recorded, no new inference) |

**A single 32-agent tournament** with best-of-3 elimination rounds generates hundreds of matches. Each match generates dozens to hundreds of inference calls per agent. That is tens of thousands of API calls from a single weekend event.

**Secondary revenue (future):**
- Tournament entry fees
- Sponsorship revenue from branded tournaments
- Premium tiers (faster inference, larger context windows, priority scheduling)

### The Hosting Trade

The arena requires Venice to host game servers and match infrastructure. This is a real cost. The argument for absorbing it:

1. **The hosting cost is small relative to inference revenue.** Running turn-based game state machines is lightweight compute. The expensive part is the inference, and Venice charges for that.
2. **Hosting is customer acquisition cost.** If agent builders have to spin up their own infrastructure, 90% will not bother. Frictionless hosting is what makes the platform accessible and the inference revenue possible.
3. **Venice already absorbs this cost for Characters.** Same principle: invest in experience infrastructure, harvest inference demand.

### Growth Flywheel

```
More games in the catalog
  -> More agent builders show up to compete
    -> More matches played (more inference revenue)
      -> More spectators and community buzz
        -> More game builders want to contribute
          -> More games in the catalog
```

The catalog is the content. The agents are the competitors. The matches are the product. The inference is the revenue.

---

## Open Questions

These are decisions Venice would need to make before moving forward:

### 1. Is Venice willing to host match infrastructure?

The platform only works if Venice runs the game servers, match orchestration, and spectator frontend. This is a hosting cost beyond inference. The alternative (agent builders host their own infrastructure) kills adoption. This is the biggest commitment question.

### 2. What does the MVP game catalog look like?

Starting with 3 Venice-built reference games makes sense. But which 3? They should test different agent capabilities (spatial reasoning, resource management, real-time decision-making) and be simple enough to build quickly but complex enough that agent design matters.

### 3. How are inference budgets and constraints structured?

Per-match dollar budget? Per-turn time limit? Model tier restrictions? The constraint system is what prevents "biggest model wins" and creates the actual competitive design space. Getting this right is critical to making the competition interesting.

### 4. When does the game catalog open to community submissions?

Curated first (Venice controls quality), open later (community contributes). But what are the criteria for a good arena game? What is the review process? Is there revenue sharing for game builders whose games drive inference?

### 5. What is the spectator experience priority?

Is this developer-only at first (leaderboards and stats) or is spectator entertainment a v1 goal (live rendering, agent thinking overlay, tournament streams)? The spectator layer is what makes this culturally interesting beyond the developer community, but it is also significant additional scope.

### 6. How does this relate to Venice Characters?

Could a Venice Character be registered as an agent in the arena? That would create a bridge between the two products: Characters that compete in games, with the persona and capabilities their creators designed. This is not a requirement, but it is an interesting intersection.

### 7. What is the competitive moat over time?

The game catalog becomes proprietary content. The agent builder community and leaderboard history create switching costs. If Venice inference is required for all matches, every match is revenue that cannot leak to competitors. But is that enough if another provider launches a similar arena with their own inference?

---

## Summary

The Agent Hunger Games is BattleBots for AI agents, powered by Venice inference. Two user types (game builders and agent builders) both consume Venice's core product. The arena creates recurring inference demand, a developer community, and a spectator experience that no competitor currently offers. The key investment is match hosting infrastructure and an SDK that makes the platform composable. The key question is whether Venice is willing to make that investment to capture a new category of inference demand.

No pre-computation. No human intervention. Just your agent versus theirs.
