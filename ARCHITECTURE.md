# Home Buyer Sync Decision-Support Architecture

## Domain boundaries

- `src/domain/models.ts` is the shared language for listings, criteria, score submissions, walkthroughs, media, CapEx, financial assumptions, and user roles. UI and API code depend on these interfaces; domain utilities do not depend on React or transport details.
- `src/domain/scoring.ts` is the pure collaborative scoring engine. It normalizes mixed 1–5/1–10 scales, applies weights, reports per-rater and per-criterion divergence, enforces blind reveal, and reports dealbreaker vetoes independently of numeric rank.
- `src/domain/financials.ts` is the pure outflow engine. It calculates amortized principal/interest, taxes, insurance, HOA, utilities, CapEx totals, and true total investment.
- `src/services/decisionApi.ts` is the typed transport boundary. Components do not construct decision-support endpoint URLs or Axios calls directly.
- `src/services/assistantApi.ts` is the typed Search Copilot transport boundary. `server/routes/assistant.ts` owns authenticated persistence and orchestration; `server/services/assistant/` owns provider-neutral generation, structured retrieval, policy, citations, and fallback.
- `server/services/linq.ts` and `server/routes/linq.ts` own the Linq conversational messaging transport boundary for bidirectional iMessage, RCS, SMS fallback, listing alerts, decision updates, and webhook ingestion.
- `server/mcp/` is the allowlisted tool boundary. MCP handlers call authorized domain services directly and never loop back through the public HTTP API.

## Component tree

```text
App
├── Dashboard
│   ├── PropertyCard (shortlist selection, 2–4 listings)
│   ├── SearchCopilot (shared threads, citations, audited actions)
│   └── Compare action → /compare?ids=...
├── Comparison
│   └── ComparativeDecisionMatrix
│       ├── WeightSensitivity controls
│       ├── Ranked listing columns
│       ├── ScoreAlignment rows
│       ├── TrueMonthlyCost / CapEx rows
│       └── Dealbreaker / pros / cons rows
├── PropertyDetail
│   ├── WeightedScoringPanel
│   │   ├── CriterionRating controls
│   │   ├── Dealbreaker controls
│   │   ├── BlindReveal status
│   │   └── Alignment summary
│   ├── ExistingChecklistEvaluation
│   └── TeamNotes
└── Checklist (existing search filters and quick-fit criteria)
```

## State and data flow

React Query owns server state and cache invalidation for listings, criteria, score submissions, inspections, and CapEx. Local component state is intentionally limited to unsubmitted scoring values and temporary comparison sensitivity weights; changing sensitivity never mutates the team’s saved criteria. Authentication remains in Zustand because it is cross-route client session state rather than fetched domain data.

The server authorizes every group-scoped property operation. Score submissions are stored per user, and blind mode suppresses all team result details until both primary and co-buyer roles have submitted. Agent comments are accepted only from an agent membership; veto status is always evaluated separately from the composite score.

## Search Copilot flow and trust boundaries

```text
Dashboard → authenticated assistant route → bounded orchestrator → Gemini provider
                                           ↘ deterministic fallback
Gemini/fallback → MCP registry → authorized Prisma services / approved public adapters
                                  ↘ AssistantToolRun audit record
```

The browser receives no Gemini or MCP credential and cannot invoke MCP directly. Routes derive the user from the JWT; domain services resolve an accepted membership and group. Model-generated identity, group, role, host, and budget values are ignored. Criteria/import writes additionally require a buyer or co-buyer role, strict Zod input, an idempotency key, rate and per-turn budgets, and a visible result summary.

MCP is in process for the current deployment. `createMcpServer` and `connectMcpTransport` keep transport replaceable; a remote deployment requires authenticated TLS, server-to-server credentials, and network controls that prevent direct browser access. `MCP_REMOTE_ENDPOINT` and `MCP_AUTH_TOKEN` are reserved configuration until that deployment adapter exists.

Listing descriptions, public pages, user text, and tool output are untrusted data. They are bounded and separated from system policy, cannot add tools or permissions, and cannot increase execution limits. External listing imports continue to use approved hosts, safe redirects, timeouts, response limits, and private-network protections. Factual market claims are shown only with normalized source name, HTTP(S) URL, observation date when available, and retrieval timestamp.

Gemini is behind the application-owned `AssistantProvider` interface and is limited by timeout, output-token, tool-call, write, and request-rate settings. Missing credentials, quota failures, timeouts, and orchestration errors enter deterministic fallback, which can parse supported criteria and retrieve the current checklist, saved-home ranking, and public links without generated prose.

The MVP uses structured relational retrieval because current data is small, group-scoped, and visibility-sensitive. `Retriever` is the extension boundary for future group-authorized document RAG. PDF parsing, chunks, embeddings, citation spans, deletion/re-indexing, managed retrieval, a second hosted provider, and local inference remain out of scope; any later adapter must retain the same authorization, MCP allowlist, policy checks, and fallback.

## Linq Conversational Messaging flow

```text
Phone (iMessage/SMS) ──> Linq Platform ──> POST /api/webhooks/linq ──> processInboundLinqMessage
                                                                            │
                                                                            ├──> Normalizes Phone (E.164)
                                                                            ├──> Resolves User & Active BuyerGroup
                                                                            ├──> Short Commands (status, top, search, help)
                                                                            └──> Search Copilot LLM Chatbot
                                                                                    ├──> AssistantThread (SMS Context)
                                                                                    ├──> MCP Tool Registry (Search, Rank, Criteria)
                                                                                    ├──> Gemini / Fallback Turn Runner
                                                                                    └──> Sends clean response via sendLinqMessage
Express API (Alerts/Invites) ──> sendLinqMessage ──> Linq REST API ──> Apple Infrastructure ──> Recipient Phone
```

Linq provides the conversational transport layer for real-time mobile notifications and an intelligent SMS real estate chatbot. Inbound messages are processed securely via HMAC signature verification (`x-linq-signature` / `x-webhook-signature`), matched against normalized user phone numbers (`User.phone`), and routed to the Search Copilot AI engine. Natural language queries, property comparisons, and advice prompts execute bounded LLM turns with MCP tool execution, maintaining thread conversation history in `AssistantThread` and `AssistantMessage` and returning concise, well-formatted replies over SMS/iMessage. Fast command shortcuts (`status`, `top`, `search <city/zip>`, `help`) provide instant structured answers. Outbound listing alerts and decision reveals format structured cards with full-screen effects (`confetti`, `sparkles`, `celebration`) and photo attachments. Multi-user collaboration ensures that when co-buyers or agents are whitelisted and registered, each participant receives tailored group search updates and alert dispatches.

## Persistence model

The normalized relationship is:

```text
BuyerGroup 1──* Criterion 1──* CriterionRating *──1 ScoreSubmission *──1 User
Property   1──* ScoreSubmission
Property   1──* CapExItem
Property   1──* WalkthroughInspection 1──* InspectionItem 1──* InspectionMedia
WalkthroughInspection 1──* AgentComment *──1 User(agent)
BuyerGroup 1──* AssistantThread 1──* AssistantMessage
AssistantThread 1──* AssistantToolRun *──1 User(invoker)
```

JSON is appropriate only for bounded inspection item/media snapshots in this SQLite implementation. Criteria, submissions, property ownership, and CapEx remain relational so they can be filtered, authorized, and aggregated without parsing opaque payloads.

## Calculation invariants

1. Each rating is clamped to its criterion scale and normalized to 0–100 before weighting.
2. Missing ratings do not silently count as zero; a rater’s denominator contains only criteria they rated.
3. Composite score is the mean of submitted rater weighted scores and is `null` while blind results are locked.
4. Divergence is reported as both mean absolute deviation and the maximum buyer score gap.
5. Any triggered binary dealbreaker produces a VETO regardless of composite score.
6. Monthly cost includes principal/interest, taxes, insurance, HOA, and utilities; CapEx is shown separately and added to purchase price for true total investment.