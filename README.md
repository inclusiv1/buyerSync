# Home Buyer Sync

Collaborative real-estate tour, scoring, cost, and comparison workspace built with React, TypeScript, Express, and Prisma.

## Local development

```bash
cp .env.example .env
npm install
npm run dev:full
```

Node.js 20.19 or newer is required.

## Invitation email

The **Send email** button creates a seven-day project invitation and delivers it through standard SMTP. Configure `PUBLIC_APP_URL` and the `SMTP_*` values shown in `.env.example`. If delivery is unavailable, the dashboard keeps the invitation valid and shows a copyable link instead.

For local testing without a mail account, use [Mailpit](https://github.com/axllent/mailpit), an open-source SMTP test server. Install and run Mailpit, keep the `.env.example` defaults (`localhost:1025`), and open `http://localhost:8025` to view received invitations. Mailpit captures local mail instead of delivering it to a real external inbox; production delivery requires SMTP credentials from a transactional email provider or your own properly configured mail server.

## Collaborative test mode

Collaborative test mode lets you use three local buyers at the same time to verify shared listings, individual scoring, comparisons, and the contributor interface. It uses the normal local development database but enables test-only account setup and login controls.

### Start test mode

Use Node.js 20.19 or newer, install the project dependencies, and run:

```bash
npm run dev:test
```

The command prepares Prisma, synchronizes the local database schema, and starts an isolated test frontend at `http://localhost:5174` with its API at `http://localhost:4301`. These dedicated ports prevent a normal development session on ports `5173` and `3001` from serving the wrong login API.

### Test accounts

The test-mode startup creates or updates these accounts and adds them as accepted contributors to `Test Collaborative Search`:

| User | Email | Search role |
| --- | --- | --- |
| Alex Morgan | `alex@test.buyersync.local` | Primary buyer |
| Blair Chen | `blair@test.buyersync.local` | Co-buyer |
| Cameron Rivera | `cameron@test.buyersync.local` | Co-buyer |

The login page displays a **Test mode** panel with a one-click button for each account, so no password is needed for the normal testing workflow.

### Test three users at once

1. On the login page, choose **Alex Morgan**.
2. On the dashboard, click **Another user** to open a separate login tab.
3. In the new tab, choose **Blair Chen**.
4. Open one more login tab and choose **Cameron Rivera**.
5. Keep each user in a separate tab. Add a home to `Test Collaborative Search`, score it in each tab, and refresh or revisit the property to compare the shared results.

Test mode stores authentication in browser `sessionStorage`, which is scoped to an individual tab. This keeps one active user in each tab instead of replacing the login in every open tab. Normal development and production use browser-wide persistent login storage instead.

### Data and safety behavior

- Setup is idempotent: restarting `npm run dev:test` reuses the three accounts and shared search rather than creating duplicates.
- Homes, scores, and other changes use the local development database and remain available after a restart. Test mode does not automatically reset or delete them.
- Stop the servers with `Ctrl+C`. Use `npm run dev` or `npm run dev:full` when you want normal local login without the test account selector.
- The test users and quick-login API are available only when `APP_MODE=test` and `NODE_ENV` is `development` or `test`. Production, QA, and UAT startup paths cannot enable them.

### Troubleshooting

- If the test account buttons do not appear, open `http://localhost:5174` and confirm the terminal says the test API is running on port `4301`. Start the workspace with `npm run dev:test`, not `npm run dev`.
- If a second login replaces the first, use the dashboard's **Another user** button or open `/login` in a new tab while test mode is running.
- If startup reports a Prisma or schema error, confirm Node.js 20.19 or newer is active, then rerun `npm install` followed by `npm run dev:test`.

## Resilient listing imports

`POST /api/properties/import` validates and canonicalizes approved HTTPS listing URLs, rate-limits requests per user, caches successful results for 15 minutes, and runs configured providers from best to most compatible:

1. PropertyWebScraper URL extraction.
2. Playwright-rendered HTML passed through PropertyWebScraper (or the local text parser).
3. HomeHarvest address enrichment for Realtor.com listings.
4. The built-in structured-data, metadata, body-text, and reader parser.
5. Editable pasted-text or manual entry in the dashboard.

Copy `.env.example` and configure the provider service URLs. Each provider is optional; an unavailable or incomplete provider automatically falls through to the next one. PropertyWebScraper, Playwright, and HomeHarvest should run as separately deployed services so Chromium and Python dependencies do not enlarge or destabilize this application process.

Provider services must also enforce outbound URL allowlists. This API rejects non-HTTPS URLs, credentials, unapproved hosts, and hosts resolving to private or link-local addresses; direct scraper redirects are restricted to supported listing hosts.

The import response remains compatible with the editable property form and adds `importMeta` containing the provider chain, completeness percentage, warnings, attempts, canonical URL, and cache status. Extracted coordinates are retained when the property is saved.

## Image credits

The editorial background photography is served by [Unsplash](https://unsplash.com) under the [Unsplash License](https://unsplash.com/license). Listing photography remains owned and supplied by its original listing source.

## Advertising

The dashboard supports custom campaigns in left, right, and bottom placements. Advertisers register at `/advertise/signup`, create a draft at `/advertiser`, and submit it for review. Campaigns serve only after an administrator approves them and marks manual invoicing as `paid` or `waived`; advertisers can see impression, click, and click-through reporting.

Promote an existing account to the permanent operator role with Prisma Studio (`npx prisma studio`) by changing the user's `role` to `admin`; that account is then routed to `/admin/ads`. Never expose this role through public registration.

For contextual inventory, configure the optional `CONTEXTUAL_AD_*` values in `.env`. The provider-neutral adapter loads only an operator-configured HTTPS script and supplies publisher, slot, and placement data attributes. Confirm the selected network's consent, privacy, and attribute requirements before production use; custom advertiser input can never inject scripts.

## Financing examples

Priced property detail pages show conventional, FHA, and illustrative VA payment examples with multiple down payments and 15- or 30-year terms. Home Buyer Sync refreshes the public Freddie Mac Primary Mortgage Market Survey benchmarks from FRED every six hours and retains the latest cached observations during an outage; no API key is required.

Credit score, income, and debt values entered in the calculator remain in the browser and are not saved. Results are educational principal-and-interest estimates rather than quotes or approvals, and the interface identifies excluded taxes, insurance, mortgage insurance, fees, and other costs. It also links to official VA, FHA, USDA, and property-state assistance resources so users can verify eligibility directly.
