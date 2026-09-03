# BuyerSync

Collaborative real-estate tour, scoring, cost, and comparison workspace built with React, TypeScript, Express, and Prisma.

## Local development

```bash
cp .env.example .env
npm install
npm run dev:full
```

Node.js 20.19 or newer is required.

## Collaborative test mode

```bash
npm run dev:test
```

Test mode creates three idempotent local accounts—Alex Morgan, Blair Chen, and Cameron Rivera—and adds all of them to `Test Collaborative Search`. The login page offers one-click account selection. Use **Another user** or open `/login` in a separate page to keep an independent login in each page and compare each buyer's scoring.

The test accounts and quick-login API are enabled only when `APP_MODE=test` and `NODE_ENV` is `development` or `test`. Production, QA, and UAT startup paths continue to use normal login and browser-wide persistent sessions.

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
