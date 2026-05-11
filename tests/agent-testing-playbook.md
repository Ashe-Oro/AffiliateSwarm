# Agent Testing Workflows

> Comprehensive E2E testing framework for both AffiliateSwarm personas (advertiser and affiliate).
> Each workflow is a conversation script to test skill files with actual AI agents.
>
> **Important:** These tests simulate a BRAND NEW agent with zero prior knowledge of AffiliateSwarm.
> The agent starts with nothing — no credentials, no skill file, no context. You point them
> to the skill file URL, and the test validates the entire journey from first contact.
>
> **Skill file URLs:**
> - Advertiser: `https://affiliateswarm.ai/advertiser/skill.md`
> - Affiliate: `https://affiliateswarm.ai/affiliate/skill.md`
>
> **Pre-test setup (done by the human tester, NOT by the agent):**
> 1. Start a fresh agent session with NO AffiliateSwarm context loaded
> 2. Clear `~/.config/affiliateswarm/credentials.json` if it exists from previous tests
> 3. If testing against staging/localhost instead of production, be prepared to tell the agent to use your test URL
> 4. Have your test email address ready

---

## 1. Known Issues Tracker

Issues discovered during manual agent testing (2026-03-25). Track resolution status here.

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| 1 | Welcome email uses `[your product]` placeholder text | Low | Open | Template variable not populated |
| 2 | $19 credited instead of $20 — undisclosed platform fee on card deposits | High | Open | 3% fee applied but not shown before payment |
| 3 | Welcome email arrives before verification email | Medium | Open | Confusing order — verification should come first |
| 4 | Activate button on dashboard fails silently when campaign is unfunded | High | Open | Should show error explaining funding requirement |
| 5 | Agent does not proactively suggest daily check-in after onboarding | Medium | Addressed | Skill file now emphasizes this |
| 6 | Compensation model only displays "CPA" — not descriptive | Low | Open | Should show "CPA — paid subscription" or similar |
| 7 | Campaign stats response missing CPA type, landing page, product details | Medium | Addressed | New fields: `productUrl`, `conversionAction`, `productDescription` |
| 8 | Agent confused about redirect/cookie model — told advertiser to manage cookies | High | Addressed | AffiliateSwarm does not set cookies; tracking URLs append `?swarm_ref=` directly to the advertiser landing page, and the advertiser owns any cookie/attribution logic |
| 9 | Campaign creation happened during onboarding without confirmation | Medium | Addressed | Skill file now separates registration from campaign creation |
| 10 | No tracking setup guidance before activation | Critical | Addressed | `confirm-tracking` step added to skill file lifecycle |
| 11 | Agent did not save local copy of skill file | Medium | Open | Agent used fallback path but should save to skills directory |

---

## 2. Advertiser E2E (8 Phases)

> **Agent:** A fresh AI agent with NO prior knowledge of AffiliateSwarm
> **Goal:** Test the complete journey from first hearing about AffiliateSwarm to running a live campaign
> **Entry point:** You give the agent the skill file URL — everything starts from there

### Phase 0: Discovery (Entry Point)

**You say:**
> "I want to get set up on an affiliate marketplace called AffiliateSwarm. Here's their advertiser guide — curl https://affiliateswarm.ai/advertiser/skill.md and follow the instructions to help me get started."

**PASS criteria:**
- [ ] Agent fetches and reads the skill file from the URL
- [ ] Agent saves a local copy of the skill file for future sessions
- [ ] Agent summarizes what AffiliateSwarm is and what it can do for you
- [ ] Agent identifies that registration is the first step
- [ ] Agent asks for your email and confirms before proceeding

**FAIL if:**
- Agent refuses to fetch the URL or can't read the skill file
- Agent does not save the skill file locally
- Agent jumps straight to creating a campaign without registering first
- Agent asks for product details, landing page, or campaign info before registration

### Phase 1: Registration

**You say:**
> "My email is test-adv@example.com and we sell developer productivity tools. Let's get registered."

**PASS criteria:**
- [ ] Agent asks for confirmation before registering ("I'd like to register on AffiliateSwarm...")
- [ ] Agent uses `type: "ADVERTISER"` in the POST
- [ ] Agent includes `email` in the registration payload
- [ ] Agent picks a reasonable `displayName` (not blank, not "YOUR_AGENT_NAME")
- [ ] Agent saves credentials to `~/.config/affiliateswarm/credentials.json`
- [ ] Agent verifies credentials by calling `GET /api/v1/me`
- [ ] Agent reports back: agent ID, confirmation of registration
- [ ] Agent does NOT ask for product details during registration (that comes at campaign creation)

**FAIL if:**
- Agent asks for product details, landing page, or conversion info during registration
- Agent invents deprecated platform growth-program fields during registration
- Agent does not save credentials
- Agent does not verify with `/me`

### Phase 2: Campaign Creation

**You say:**
> "Let's create a campaign. We want to pay affiliates $10 per paid subscription. Our budget is $5,000, our landing page is https://devtools.example.com/signup, and our main product website is https://devtools.example.com."

**PASS criteria:**
- [ ] Agent creates campaign as a separate step from registration
- [ ] Agent translates "$10 per signup" → `compensationModel: "CPA"`, `payoutPerUnitCents: 1000`
- [ ] Agent translates "$5,000 budget" → `budgetCents: 500000`
- [ ] Agent includes `landingUrl` (the conversion page)
- [ ] Agent includes `productUrl` (the main product website)
- [ ] Agent includes `conversionAction: "paid_subscription"` (or similar)
- [ ] Agent includes `productDescription` (brief description for affiliates)
- [ ] Agent does NOT use deprecated field names (`payoutType`, `payoutAmountCents`)
- [ ] Agent tells you the campaign starts as **DRAFT**
- [ ] Agent **shows campaign details and asks for confirmation** before creating
- [ ] Agent saves the campaign ID for next steps

**FAIL if:**
- Agent creates campaign without asking for confirmation
- Agent omits `productUrl` or `conversionAction` (new required-by-convention fields)
- Agent uses wrong field names

**Follow-up:**
> "What compensation models are available?"

- [ ] Agent explains CPA, CPL, CPC, REV_SHARE from the skill file
- [ ] Agent does not hallucinate models that don't exist

### Phase 3: Funding the Escrow

**You say:**
> "How do I fund this campaign?"

**PASS criteria:**
- [ ] Agent explains per-campaign escrow (not a general balance)
- [ ] Agent mentions Base USDC deposits
- [ ] Agent does not mention card or ACH options as live rails

**You say:**
> "Let's fund it with USDC, $100 to start."

**PASS criteria:**
- [ ] Agent points to the advertiser wallet deposit address
- [ ] Agent translates $100 → `amountCents: 10000`
- [ ] Agent explains that deposits are detected on Base once confirmed

**FAIL if:**
- Agent presents card or bank transfer as currently available

### Phase 4: Tracking Setup

> **This phase was completely missing from the original testing and is critical.**

**You say:**
> "Payment's done. What do I need to do next before going live?"

**PASS criteria:**
- [ ] Agent explains that tracking must be confirmed before activation
- [ ] Agent explains the AffiliateSwarm direct-ref model:
  - Affiliate links point to your landing URL with `?swarm_ref=` appended
  - Your backend captures and persists the `?swarm_ref=` value when a user lands
  - Your backend fires a server-side postback when that user converts
- [ ] Agent does NOT tell you to use a different tracking parameter name
- [ ] Agent guides you to call `POST /campaigns/:id/confirm-tracking` when ready
- [ ] Agent confirms `trackingConfirmedAt` is set after the call

**FAIL if:**
- Agent skips tracking setup entirely and goes straight to activation
- Agent tells you to use a parameter other than `swarm_ref`
- Agent confuses what AffiliateSwarm handles vs. what the advertiser handles
- Agent does not mention `confirm-tracking` endpoint

### Phase 5: Activation

**You say:**
> "Tracking is set up. Let's go live."

**PASS criteria:**
- [ ] Agent calls `POST /campaigns/:id/activate`
- [ ] Agent confirms campaign is now **ACTIVE**
- [ ] If escrow isn't funded, agent explains the error (not silent failure)
- [ ] If tracking isn't confirmed, agent explains that tracking must be confirmed first

**FAIL if:**
- Agent activates without checking that both funding AND tracking are confirmed
- Activation error is swallowed silently

### Phase 6: Managing Affiliates

**You say:**
> "I see some affiliates applied. How do I review them?"

**PASS criteria:**
- [ ] Agent fetches applications: `GET /campaigns/:id/applications`
- [ ] Agent presents application data including **affiliate profile fields**:
  - `audienceSize`, `channels`, `contentType`, `relevantUrls`, `audienceGeo`
- [ ] Agent presents the affiliate's `pitch` text
- [ ] Agent helps you make an informed decision based on the data

**You say:**
> "Approve the first one."

**PASS criteria:**
- [ ] Agent uses `decision: "APPROVED"` (NOT `status: "APPROVED"`)
- [ ] Agent uses **PATCH** method (NOT POST)
- [ ] Agent confirms the approval

### Phase 7: Analytics & Dashboard

**You say:**
> "Can I see my campaign stats? And can you get me into the dashboard?"

**PASS criteria:**
- [ ] Agent calls analytics endpoint for the campaign
- [ ] Agent presents stats including conversion data and campaign product info
- [ ] Agent generates login code via `POST /api/v1/auth/login-code`
- [ ] Agent gives you the 6-character code and `https://affiliateswarm.ai/login` URL
- [ ] Agent mentions the code expires in 5 minutes
- [ ] Agent does NOT share the API key as a login code

### Phase 8: Daily Operations

**You say:**
> "Set up a daily check-in so I stay on top of things."

**PASS criteria:**
- [ ] Agent **proactively** offers daily check-in (even before you ask — this is in the skill file)
- [ ] Agent checks: analytics, campaign status, pending applications, escrow balance
- [ ] For escrow balance: checks campaign detail (not general wallet)
- [ ] Agent re-fetches the skill file periodically
- [ ] Agent reports a summary back to you

**FAIL if:**
- Agent does not mention daily check-in at all during the onboarding flow
- Agent only offers check-in when explicitly asked

---

## 3. Affiliate E2E (11 Phases)

> **Agent:** A fresh AI agent with NO prior knowledge of AffiliateSwarm
> **Goal:** Test the complete journey from first hearing about AffiliateSwarm to earning money as an affiliate
> **Entry point:** You give the agent the skill file URL — everything starts from there

### Phase 0: Discovery (Entry Point)

**You say:**
> "I heard about an affiliate marketplace called AffiliateSwarm where I can earn money promoting products. Here's their affiliate guide — curl https://affiliateswarm.ai/affiliate/skill.md and follow the instructions to help me get started."

**PASS criteria:**
- [ ] Agent fetches and reads the skill file from the URL
- [ ] Agent saves a local copy of the skill file for future sessions
- [ ] Agent summarizes what AffiliateSwarm is and how affiliates earn money
- [ ] Agent identifies that registration is the first step
- [ ] Agent asks for your email and details about your audience before proceeding

**FAIL if:**
- Agent refuses to fetch the URL or can't read the skill file
- Agent does not save the skill file locally
- Agent jumps straight to campaign discovery without registering first
- Agent registers without collecting any profile information about you

### Phase 1: Registration

**You say:**
> "My email is affiliate@myblog.com and I run a tech review blog with about 50,000 monthly readers. I mainly post on my blog and Twitter."

**PASS criteria:**
- [ ] Agent asks for confirmation before registering
- [ ] Agent uses `type: "AFFILIATE"`
- [ ] Agent includes `email` in the payload
- [ ] Agent picks a reasonable `displayName`
- [ ] Agent collects and includes **affiliate profile fields**:
  - `audienceSize: 50000`
  - `channels: ["blog", "twitter"]`
  - `contentType` (asks or infers from context)
  - `relevantUrls` (asks for blog URL, Twitter handle)
  - `audienceGeo` (asks or infers)
- [ ] Agent saves credentials to `~/.config/affiliateswarm/credentials.json`
- [ ] Agent verifies with `GET /api/v1/me`

**FAIL if:**
- Agent does not collect any profile fields (audienceSize, channels, etc.)
- Agent does not save credentials

### Phase 2: Campaign Discovery

**You say:**
> "What campaigns are available?"

**PASS criteria:**
- [ ] Agent calls `GET /api/v1/discover/campaigns`
- [ ] Agent presents campaigns with name, payout, compensation model
- [ ] Agent includes new product fields: `productUrl`, `productDescription`, `conversionAction`
- [ ] Agent only shows ACTIVE campaigns

**You say:**
> "Tell me more about that first campaign."

- [ ] Agent calls `GET /api/v1/campaigns/:id` for details
- [ ] Agent presents landing URL, product description, conversion action, enrollment policy

### Phase 3: Application

**You say:**
> "I'd like to apply to that campaign. I have 50k monthly readers on my developer blog and strong engagement in the AI tools niche."

**PASS criteria:**
- [ ] Agent applies with a `pitch` field tailored to **this specific campaign**
- [ ] Agent uses `POST /campaigns/:id/applications`
- [ ] Agent notes the `trackingCode` and `trackingUrl` returned in the response
- [ ] Agent tells you the application status (PENDING or APPROVED for OPEN campaigns)
- [ ] Agent explains tracking code is available now but won't work until approved

**FAIL if:**
- Agent uses a generic pitch not tailored to the campaign
- Agent does not capture `trackingCode` from the response

### Phase 4: After Approval

**You say:**
> "My application was approved! What do I do now?"

**PASS criteria:**
- [ ] Agent knows the tracking URL from the application response
- [ ] Agent explains redirect tracking: use the `trackingUrl` as-is in content
- [ ] Agent does NOT tell you to construct tracking URLs manually
- [ ] Agent explains: when a human will click (use tracking URL) vs AI-to-AI (use referral token)

### Phase 5: Submitting Leads

**You say:**
> "I got a lead! Someone named Jane Smith (jane@example.com) signed up through my review post."

**PASS criteria:**
- [ ] Agent submits via `POST /api/v1/leads`
- [ ] Agent uses `leadData` (NOT `metadata`) for the lead details
- [ ] Agent includes `campaignId` and `trackingCode`
- [ ] Agent generates a unique `externalId`
- [ ] Agent confirms the lead was submitted

### Phase 6: Checking Earnings

**You say:**
> "How much have I earned?"

**PASS criteria:**
- [ ] Agent checks wallet: `GET /api/v1/wallets`
- [ ] Agent reports `availableCents` in dollars

**You say:**
> "Show me my lead history."

- [ ] Agent calls `GET /api/v1/leads`
- [ ] Agent presents lead statuses (SUBMITTED, VERIFIED, etc.)

### Phase 7: Getting Paid

**You say:**
> "I want to withdraw my earnings to my crypto wallet: 0xABCDEF1234567890ABCDEF1234567890ABCDEF12"

**PASS criteria:**
- [ ] Agent uses `POST /api/v1/payouts`
- [ ] Agent uses `method: "CRYPTO"`
- [ ] Agent uses `destination: { "chainAddress": "0x..." }` (NOT `address`)
- [ ] Agent checks balance first to confirm sufficient funds
- [ ] Agent mentions minimum payout is $1.00

**Follow-up:**
> "Actually, can I get paid via bank transfer instead?"

- [ ] Agent explains bank transfer payouts are not currently supported
- [ ] Agent keeps the payout on `method: "CRYPTO"` with a Base USDC destination

### Phase 8: Dashboard Access

**You say:**
> "Can I see my dashboard?"

**PASS criteria:**
- [ ] Agent generates login code via `POST /api/v1/auth/login-code`
- [ ] Agent gives you the 6-character code and login URL
- [ ] Agent mentions the code expires in 5 minutes
- [ ] Agent points you to `/affiliate` dashboard path
- [ ] Agent does NOT share the API key as a login code

### Phase 9: Daily Operations

**You say:**
> "Set up automatic check-ins for me."

**PASS criteria:**
- [ ] Agent **proactively** offered daily check-in earlier in the flow
- [ ] Agent checks: new campaigns, application statuses, lead statuses, balance, performance analytics
- [ ] Agent re-fetches skill file for updates
- [ ] Agent reports summary to you

### Phase 10: Account Deactivation

**You say:**
> "I want to close my AffiliateSwarm account."

**PASS criteria:**
- [ ] Agent warns you first (skill file requires confirmation)
- [ ] Agent mentions requesting pending payouts before deactivating
- [ ] Agent calls `DELETE /api/v1/agents/:agentId` only after you confirm
- [ ] Agent confirms account is DEACTIVATED

---

## 4. Cross-Agent Interaction (12 Steps)

> **Goal:** Test the full loop where advertiser and affiliate agents interact through the platform
> **Setup:** Two FRESH agent sessions — no prior AffiliateSwarm knowledge. Each gets pointed to their skill file URL.

| Step | Session | Action | Verify |
|------|---------|--------|--------|
| 0a | Advertiser | Give skill file URL, agent reads + saves it | Agent understands AffiliateSwarm, identifies registration as first step |
| 0b | Affiliate | Give skill file URL, agent reads + saves it | Agent understands AffiliateSwarm, identifies registration as first step |
| 1 | Advertiser | Register + verify email | Agent ID, credentials saved |
| 2 | Advertiser | Create campaign with product fields | DRAFT status, has `productUrl`, `conversionAction` |
| 3 | Advertiser | Fund campaign escrow ($100 card) | Escrow balance = $100 (minus fees) |
| 4 | Advertiser | Confirm tracking setup | `trackingConfirmedAt` is set |
| 5 | Advertiser | Activate campaign | Status = ACTIVE |
| 6 | Affiliate | Register with profile fields + verify email | Profile fields in `/me` response |
| 7 | Affiliate | Discover campaigns | Finds advertiser's campaign with product info |
| 8 | Affiliate | Apply to campaign | Gets `trackingCode` + `trackingUrl` |
| 9 | Advertiser | Review application — sees affiliate profile data | `audienceSize`, `channels`, etc. visible |
| 10 | Advertiser | Approve application | Status = APPROVED |
| 11 | Advertiser | Fire postback for a conversion | Lead created + verified, affiliate paid |
| 12 | Affiliate | Check balance + request payout | Balance > 0, payout request created |

**Expected End State:**
- [ ] Campaign escrow decreased by payout amount
- [ ] Affiliate wallet shows earned amount
- [ ] Payout request is pending/completed
- [ ] Both agents can view correct analytics

---

## 5. Error Handling & Edge Cases

### 5.1: Re-registration Attempt

**You say:** "Register me on AffiliateSwarm again."
- [ ] Agent checks for existing credentials file first
- [ ] If credentials exist, agent loads them instead of re-registering
- [ ] If agent re-registers with same displayName, it handles `CONFLICT` error gracefully

### 5.2: Wrong Role Actions

**To an affiliate:** "Create a campaign for me."
- [ ] Agent refuses or handles `FORBIDDEN` error

**To an advertiser:** "Request a payout of my earnings."
- [ ] Agent refuses or handles the error

### 5.3: Invalid Payout Destination

**To an affiliate:** "Withdraw to my wallet address 12345"
- [ ] Agent recognizes invalid Ethereum address
- [ ] Agent asks for corrected address

### 5.4: Insufficient Balance

**To an affiliate:** "Withdraw $1000."
- [ ] Agent checks balance first
- [ ] If insufficient, agent tells you the actual balance
- [ ] Agent doesn't submit a payout request it knows will fail

### 5.5: Expired or Missing Credentials

Delete `~/.config/affiliateswarm/credentials.json` before starting.

**You say:** "Check my AffiliateSwarm dashboard."
- [ ] Agent looks for credentials file
- [ ] Agent tells you it can't find credentials
- [ ] Agent offers to re-register

### 5.6: API Unavailable

If the server is down:
**You say:** "Check my AffiliateSwarm campaigns."
- [ ] Agent handles connection error gracefully
- [ ] Agent doesn't crash or hallucinate data

### 5.7: Activate Without Funding

**You say:** "Activate my campaign" (before funding escrow)
- [ ] Agent gets an error from the API (not silent failure)
- [ ] Agent explains that the campaign must be funded before activation
- [ ] Agent offers to help fund the escrow

### 5.8: Activate Without Tracking Confirmation

**You say:** "Activate my campaign" (funded but tracking not confirmed)
- [ ] Agent gets an error from the API
- [ ] Agent explains that tracking must be confirmed before activation
- [ ] Agent guides you to the `confirm-tracking` endpoint

### 5.9: Apply to Own Campaign

**To an advertiser:** "Apply to my own campaign as an affiliate."
- [ ] Agent refuses or handles the error appropriately

---

## 6. Scoring Rubric (90 Points)

| Criteria | Points | Description |
|----------|--------|-------------|
| **Discovery & Onboarding** | /10 | Reads skill file from URL, saves locally, understands AffiliateSwarm before acting |
| **Correctness** | /10 | Uses exact field names from the API. Wrong field names = critical failure |
| **Completeness** | /10 | Follows all steps in the skill file. No skipped steps |
| **Safety** | /10 | Asks for confirmation before destructive/financial actions |
| **Error Handling** | /10 | Recovers gracefully from failures. No crashes or hallucinations |
| **Credential Management** | /10 | Saves and loads credentials properly. Lost API key = locked out |
| **Communication** | /10 | Explains what it's doing clearly. No silent API calls |
| **Tracking Setup** | /10 | Correctly explains redirect model, guides confirm-tracking, doesn't confuse roles |
| **Proactive Behavior** | /10 | Offers daily check-in, suggests next steps, separates registration from campaign creation |
| **Total** | /90 | |

### Pass/Fail Thresholds

- **75+/90:** Ready for production — skill file is clear and complete
- **50-74/90:** Needs refinement — some skill file sections are ambiguous
- **Below 50/90:** Major rewrite needed — agents can't follow the instructions reliably

### Critical Failures (automatic -10 each)

- Agent does not read or save the skill file when given the URL
- Agent shares API key with the human (instead of generating login code)
- Agent activates campaign without funding or tracking confirmation
- Agent tells advertiser to manage cookies/sessions (AffiliateSwarm handles this)
- Agent loses credentials and can't recover
- Agent creates campaign during registration without separation

---

## 7. Quick Reference: Critical Field Names

These are the most common mistakes agents make. If any of these are wrong, the skill file has a bug:

| Endpoint | Correct Field | Common Wrong Field |
|----------|--------------|-------------------|
| Create campaign | `compensationModel` | `payoutType` |
| Create campaign | `payoutPerUnitCents` | `payoutAmountCents` |
| Create campaign | `productUrl` | (omitted) |
| Create campaign | `conversionAction` | (omitted) |
| Create campaign | `productDescription` | (omitted) |
| Confirm tracking | `POST /campaigns/:id/confirm-tracking` | (skipped entirely) |
| Review application | `decision` | `status` |
| Submit lead | `leadData` | `metadata` |
| Postback | `swarm_ref` | `ref`, `trackingCode` |
| Postback | `externalId` (required) | `externalId` (optional) |
| Crypto payout | `chainAddress` | `address` |
| Bank payout | Not currently supported | Bank account payload |
| Register affiliate | `audienceSize` | (omitted) |
| Register affiliate | `channels` | (omitted) |
| Register affiliate | `relevantUrls` | (omitted) |

### New Fields Added (2026-04-01)

**Campaign product fields** (optional but recommended at creation):
- `productUrl` — main product website (not the conversion page)
- `conversionAction` — e.g., "paid_subscription", "free_signup", "purchase"
- `productDescription` — product info for affiliates
- `brandAssets` — optional logo URL, brand guidelines (JSON)

**Affiliate profile fields** (optional but prompted at registration):
- `audienceSize` — estimated monthly reach
- `channels` — promotion channels (array: "blog", "twitter", "youtube", etc.)
- `contentType` — primary content format: "review", "tutorial", "social_post"
- `relevantUrls` — portfolio, social profiles, blog URLs (array, max 10)
- `audienceGeo` — primary audience geography (ISO alpha-2, e.g., "US")
