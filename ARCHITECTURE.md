# BuyerSync Decision-Support Architecture

## Domain boundaries

- `src/domain/models.ts` is the shared language for listings, criteria, score submissions, walkthroughs, media, CapEx, financial assumptions, and user roles. UI and API code depend on these interfaces; domain utilities do not depend on React or transport details.
- `src/domain/scoring.ts` is the pure collaborative scoring engine. It normalizes mixed 1–5/1–10 scales, applies weights, reports per-rater and per-criterion divergence, enforces blind reveal, and reports dealbreaker vetoes independently of numeric rank.
- `src/domain/financials.ts` is the pure outflow engine. It calculates amortized principal/interest, taxes, insurance, HOA, utilities, CapEx totals, and true total investment.
- `src/services/decisionApi.ts` is the typed transport boundary. Components do not construct decision-support endpoint URLs or Axios calls directly.

## Component tree

```text
App
├── Dashboard
│   ├── PropertyCard (shortlist selection, 2–4 listings)
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

## Persistence model

The normalized relationship is:

```text
BuyerGroup 1──* Criterion 1──* CriterionRating *──1 ScoreSubmission *──1 User
Property   1──* ScoreSubmission
Property   1──* CapExItem
Property   1──* WalkthroughInspection 1──* InspectionItem 1──* InspectionMedia
WalkthroughInspection 1──* AgentComment *──1 User(agent)
```

JSON is appropriate only for bounded inspection item/media snapshots in this SQLite implementation. Criteria, submissions, property ownership, and CapEx remain relational so they can be filtered, authorized, and aggregated without parsing opaque payloads.

## Calculation invariants

1. Each rating is clamped to its criterion scale and normalized to 0–100 before weighting.
2. Missing ratings do not silently count as zero; a rater’s denominator contains only criteria they rated.
3. Composite score is the mean of submitted rater weighted scores and is `null` while blind results are locked.
4. Divergence is reported as both mean absolute deviation and the maximum buyer score gap.
5. Any triggered binary dealbreaker produces a VETO regardless of composite score.
6. Monthly cost includes principal/interest, taxes, insurance, HOA, and utilities; CapEx is shown separately and added to purchase price for true total investment.