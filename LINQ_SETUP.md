# Linq CLI Setup & Activity Reference

This document serves as a centralized reference for your Linq messaging integration, maximizing project efficiency and providing seamless onboarding for conversational agent workflows.

## Account & Integration Details

- **Account Holder**: David Robertson
- **Login Email**: `inclusiv1@gmail.com`
- **Account Tier**: Free (Shared Line — up to 20 authorized contacts)
- **Linq Number**: `+12054909563`
- **Primary Contact**: `+17704904583`
- **Active Chat ID**: `035c601a-89dd-4150-a3d0-bb1498ca17fd`
- **API Key Backup Location**: `~/Downloads/linq-api-key.txt` (or retrieve anytime via `linq tokens show`)

---

## Live Activity & Verification History

- **Account Provisioning**: Created with reference token; Linq Number `+12054909563` assigned.
- **Contact Setup**: Added `+17704904583` to contact whitelist.
- **Inbound Message Received**: Contact texted `"Hello"` (Message ID: `aa0aec85-a6b9-4d00-904b-20677336886c`, Service: `RCS` / upgraded to `iMessage`).
- **Outbound Message Dispatched**: Sent `"Hello from your Linq CLI"` (Message ID: `1b012f53-0b8d-478b-8345-55d07d6ba249`).
- **iMessage Screen Effect Verified**: Dispatched `"🎉 here's confetti"` with `confetti` screen effect (Message ID: `c4299550-0ef7-46fc-b692-173a34a0a9af`).
- **Reaction Verified**: Reacted with ❤️ (`love`) to inbound message (`aa0aec85-a6b9-4d00-904b-20677336886c`).
- **Typing Indicator Verified**: Activated and deactivated typing status in chat `035c601a-89dd-4150-a3d0-bb1498ca17fd`.

---

## Quick Command Reference

### Authentication & Profile
```bash
# Verify current identity and line status
linq whoami

# Health check configuration and network connectivity
linq doctor

# View stored API token
linq tokens show
```

### Contact Management
```bash
# List all registered contacts
linq contacts list

# Add a new contact (E.164 format)
linq contacts add +1XXXXXXXXXX

# Remove an existing contact
linq contacts remove +1XXXXXXXXXX
```

### Messaging & Effects
```bash
# Create a new conversation and send an initial message
linq chats create --to +1XXXXXXXXXX --message "Hello from your agent" --json

# Send a follow-up message into an existing chat
linq messages send <chat-id> --message "Important update" --json

# Send an iMessage with animations/effects (confetti, fireworks, lasers, sparkles, etc.)
linq messages send <chat-id> --message "🎉 Congratulations!" --effect confetti --json

# Add reactions (love, like, dislike, laugh, emphasize, question, custom)
linq messages react <message-id> --type love --json

# Typing indicators
linq chats typing <chat-id>
linq chats typing <chat-id> --stop
```

### Webhooks & Real-time Event Streaming
```bash
# Stream live inbound events directly in terminal
linq webhooks listen

# Stream and forward live payloads to your local development server
linq webhooks listen --forward-to http://localhost:3001/api/webhooks/linq

# Create a permanent webhook endpoint for production
linq webhooks create --url https://your-domain.com/api/webhooks/linq --all-events
```

---

## Backend Application Integration

The Express backend now integrates Linq messaging as a first-class service (`server/services/linq.ts`) with dedicated HTTP routes (`server/routes/linq.ts`):

### 1. Environment Configuration
Add the following optional variables to your `.env` file (if omitted, the app will automatically read credentials from `~/.linq/config.json` or `~/Downloads/linq-api-key.txt`):

```bash
# Linq Messaging Integration
LINQ_API_TOKEN=linq_xxxxxxxxxxxxxxxxxxxxxxxx
LINQ_PHONE_NUMBER=+12054909563
LINQ_API_BASE_URL=https://api.linqapp.com/api/partner/v3
LINQ_WEBHOOK_SECRET=your_optional_webhook_hmac_secret
```

### 2. Available API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/linq/status` | Public | Returns current Linq configuration status, line number, and endpoint settings. |
| `POST` | `/api/webhooks/linq` | Public / HMAC | Ingests real-time events from Linq (inbound messages, reactions, typing) and triggers auto-replies. |
| `POST` | `/api/linq/send` | Authenticated | Dispatches direct SMS/iMessage with effects (`confetti`, `sparkles`, `spotlight`, etc.). |
| `POST` | `/api/linq/alert-listing` | Authenticated | Sends a formatted listing alert card with price, specs, photos, and deep link to a phone number. |
| `POST` | `/api/linq/alert-decision` | Authenticated | Sends collaborative decision / score reveal notifications with celebration effects. |
| `POST` | `/api/invites` | Authenticated | Sends buyer group collaboration invites with automatic SMS delivery when `phone` is provided. |

### 3. Conversational SMS Chatbot & Inbound Commands

When buyers, co-buyers, or agents text your Linq Number (`+12054909563`), the inbound webhook automatically processes their request with the Search Copilot AI engine and replies in real time:

#### Natural Language LLM Conversations
You can ask any free-form question or converse with the AI real estate agent directly via text:
- **Real Estate & Market Advice**: *"What are good questions to ask during an open house in Georgia?"*, *"How do mortgage interest rates affect our monthly payment?"*, *"What should we offer on a house listed for $500k?"*
- **Property Analysis & Comparisons**: *"Compare 123 Main St with our criteria"*, *"What are the trade-offs of an older home vs new construction?"*
- **Criteria Updates**: *"Can we update our budget to $650k?"*, *"Set minimum bedrooms to 4 in Smyrna"*
- **Multi-Turn Context**: The assistant preserves conversational history across SMS messages within your buyer group thread, enabling continuous multi-turn dialogue.

#### Fast Command Shortcuts
- **`status` / `summary`**: Returns active group search criteria (location, budget, rooms) and saved property count.
- **`top` / `saved` / `shortlist`**: Returns the top saved properties in the buyer group with prices and specs.
- **`search <city/zip>` / `find <query>`**: Searches saved group properties or discovers live listings (e.g. `search Atlanta` or `search 30080`).
- **`help` / `commands`**: Displays available SMS commands and assistant capabilities.

---

## Automatic Startup in Development & Production

When you start the application in either **development** (`npm run dev`) or **production** (`npm start`), the backend server automatically launches and manages the Linq webhook relay listener in the background:

- **Automatic Port Binding**: Forwards live incoming iMessage / SMS webhook events to `http://localhost:<PORT>/api/webhooks/linq` without requiring a separate terminal window.
- **Session Signing Secret Sync**: Automatically detects and registers the active listen session signing secret for webhook verification.
- **Auto-Reconnection & Resilience**: Handles connection drops and reconnects automatically.
- **Graceful Lifecycle**: Terminates cleanly when the backend server stops (SIGINT / SIGTERM / exit).

### Configuration Options (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `LINQ_AUTO_LISTEN` | `true` | Set to `false` to disable automatic background listener startup (e.g. in customized CI or container setups). |
| `LINQ_FORWARD_URL` | `http://localhost:<PORT>/api/webhooks/linq` | Custom forward URL for webhook relaying. |
| `LINQ_CLI_PATH` | (auto-detected) | Explicit path to the `linq` CLI executable if not on standard PATH. |

### Manual Standalone Commands

If you ever wish to run the listener separately:
```bash
# Using npm scripts
npm run dev:linq
# Or
npm run linq:listen

# Or directly via CLI
linq webhooks listen --forward-to http://localhost:3001/api/webhooks/linq
```

---

## Shared Line Operating Protocol

Because this line operates under the Free Shared Line tier:
1. **Inbound-First Rule**: Contacts must send an initial inbound SMS/iMessage to `+12054909563` before the agent can dispatch outbound messages to them.
2. **Contact Limit**: Up to 20 unique contacts can be registered concurrently.
3. **Conversational Compliance**: Built specifically for two-way conversational interactions rather than unsolicited bulk notifications.

---

## Testing with Other Users (Co-Buyers & Agents)

To maximize collaboration efficiency and verify multi-user workflows (e.g. primary buyer, co-buyer, and real estate agent all receiving synchronized alerts and querying group status), follow this end-to-end testing protocol:

### Step 1: Whitelist the New User's Phone Number
Add the new user's phone number (in E.164 format) to your Linq contact whitelist:

```bash
linq contacts add +1XXXXXXXXXX
```
*Tip: The command will output a direct pre-filled share link (e.g., `https://linqapp.com/s/text/+12054909563?from=+1XXXXXXXXXX&msg=hi%20from%20linq`). You can share this link with the user to open Messages with one tap or display a QR code.*

### Step 2: User Sends the Initial Inbound Text
Have the new user send an initial text (e.g., `"Hello"` or `"hi"`) from their mobile device to your Linq Number: **`+12054909563`**.
- This satisfies the Apple infrastructure inbound-first requirement for the Shared Line tier.
- Once completed, bidirectional communication (effects, alerts, invites, typing bubbles) is fully unlocked for that number.

### Step 3: Link the Phone Number to the Buyer Group in App
Ensure the user's phone number is associated with their account or group membership in Home Buyer Sync:
- **Option A (UI Team Invite with SMS)**: In the Dashboard under "Your team", enter the user's email, mobile phone number, and select their role (Co-Buyer or Agent). Clicking "Send Email & SMS Invite" automatically dispatches an SMS with the invitation link and records their phone number.
- **Option B (Invite Acceptance Flow)**: When the user opens the invite link (`/invite/:token`), they can confirm or update their mobile phone number directly on the acceptance form to opt in to messaging.
- **Option C (Direct Signup)**: Users creating a new account on `/signup` can provide their mobile phone number during registration.
- **Option D (Header Profile Settings)**: Existing logged-in users can click the user profile / phone button in the top navigation header at any time to add or update their linked phone number and view their active SMS status.

### Step 4: Test Inbound Conversational Bot from Other Users
Have the co-buyer or agent text the Linq Number directly from their phone to test group-aware querying:
- Text **`status`**: Verifies that the webhook correctly recognizes their phone number, resolves their specific buyer group, and returns active budget/criteria.
- Text **`top`**: Returns the group's current top-scored saved homes.
- Text **`search Smyrna`**: Searches and returns matching properties in the group.
- Text **`help`**: Displays available interactive commands.

### Step 5: Test Outbound Alerts & Collaborative Triggers
Trigger real-time notifications to the new user to verify delivery:
- **Listing Alert (`POST /api/linq/alert-listing`)**: Dispatch a new property alert to the co-buyer's phone with price, specs, photos, and sparkles effect.
- **Decision Alert (`POST /api/linq/alert-decision`)**: Trigger a collaborative score update or dealbreaker alert with celebration effects upon completing property scoring.

---

## Helpful Resources

- **REST API Documentation**: [https://apidocs.linqapp.com](https://apidocs.linqapp.com)
- **Web Dashboard**: [https://dashboard.linqapp.com](https://dashboard.linqapp.com)
- **Official CLI Repository**: [https://github.com/linq-team/linq-cli](https://github.com/linq-team/linq-cli)
- **Example Applications & Architectures**: [https://linqapp.com/s/example-apps](https://linqapp.com/s/example-apps)
