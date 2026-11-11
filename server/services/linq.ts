import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto, { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { searchPublicListings } from './listingSearch';
import { createMcpToolRegistry, type McpExecutionContext, type ToolName } from '../mcp';
import { type AssistantToolExecutor } from './assistant/fallback';
import { createGeminiProvider } from './assistant/gemini';
import { runAssistantTurn } from './assistant/orchestrator';
import type { AssistantProvider, AssistantToolDefinition, AssistantTurnResult } from './assistant/types';

export type LinqEffect =
  | 'confetti'
  | 'fireworks'
  | 'lasers'
  | 'sparkles'
  | 'celebration'
  | 'hearts'
  | 'love'
  | 'balloons'
  | 'happy_birthday'
  | 'echo'
  | 'spotlight'
  | 'slam'
  | 'loud'
  | 'gentle'
  | 'invisible';

export type LinqReactionType =
  | 'love'
  | 'like'
  | 'dislike'
  | 'laugh'
  | 'emphasize'
  | 'question'
  | 'custom';

export interface LinqConfig {
  apiToken: string | null;
  apiBaseUrl: string;
  phoneNumber: string;
  webhookSecret: string | null;
  isConfigured: boolean;
}

export interface SendLinqMessageOptions {
  to: string;
  message: string;
  effect?: LinqEffect;
  attachmentUrl?: string;
  replyToMessageId?: string;
}

export interface LinqSendResult {
  success: boolean;
  messageId?: string;
  chatId?: string;
  reason?: string;
  error?: string;
}

export interface ListingAlertData {
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  price?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  photos?: string[];
  url?: string | null;
}

export interface LinqWebhookEvent {
  id?: string;
  type: string;
  createdAt?: string;
  data: {
    chatId?: string;
    messageId?: string;
    from?: string;
    to?: string;
    text?: string;
    isFromMe?: boolean;
    service?: string;
    reaction?: {
      type: string;
      emoji?: string;
      operation?: string;
    };
    [key: string]: unknown;
  };
}

/**
 * Resolves the Linq API token from environment variables or local fallback files.
 */
export function getLinqApiToken(): string | null {
  if (process.env.LINQ_API_TOKEN?.trim()) {
    return process.env.LINQ_API_TOKEN.trim();
  }
  if (process.env.LINQ_API_KEY?.trim()) {
    return process.env.LINQ_API_KEY.trim();
  }

  // Check ~/.linq/config.json
  try {
    const configPath = path.join(os.homedir(), '.linq', 'config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (typeof parsed?.token === 'string' && parsed.token.trim()) {
        return parsed.token.trim();
      }
      if (typeof parsed?.apiKey === 'string' && parsed.apiKey.trim()) {
        return parsed.apiKey.trim();
      }
      if (parsed?.profiles && typeof parsed.activeProfile === 'string') {
        const profileToken = parsed.profiles[parsed.activeProfile]?.token;
        if (typeof profileToken === 'string' && profileToken.trim()) {
          return profileToken.trim();
        }
      }
    }
  } catch {
    // Ignore config read failures
  }

  // Check ~/Downloads/linq-api-key.txt
  try {
    const downloadPath = path.join(os.homedir(), 'Downloads', 'linq-api-key.txt');
    if (fs.existsSync(downloadPath)) {
      const raw = fs.readFileSync(downloadPath, 'utf8').trim();
      if (raw.length > 0 && !raw.includes('\n')) {
        return raw;
      }
    }
  } catch {
    // Ignore fallback read failures
  }

  return null;
}

let sessionWebhookSecret: string | null = null;

/**
 * Sets the active session webhook secret (e.g. from dynamic linq webhooks listen sessions).
 */
export function setLinqWebhookSecret(secret: string | null): void {
  sessionWebhookSecret = secret ? secret.trim() : null;
}

/**
 * Returns current Linq configuration state.
 */
export function getLinqConfig(): LinqConfig {
  const token = getLinqApiToken();
  const apiBaseUrl = (process.env.LINQ_API_BASE_URL || 'https://api.linqapp.com/api/partner/v3').replace(/\/+$/, '');
  const phoneNumber = process.env.LINQ_PHONE_NUMBER?.trim() || '+12054909563';
  const webhookSecret = process.env.LINQ_WEBHOOK_SECRET?.trim() || sessionWebhookSecret;

  return {
    apiToken: token,
    apiBaseUrl,
    phoneNumber,
    webhookSecret,
    isConfigured: Boolean(token),
  };
}

/**
 * Normalizes phone numbers to E.164 format (e.g. +14155551234).
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    return digits;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

const SCREEN_EFFECTS = [
  'confetti',
  'fireworks',
  'lasers',
  'sparkles',
  'celebration',
  'hearts',
  'love',
  'balloons',
  'happy_birthday',
  'echo',
  'spotlight',
];

const BUBBLE_EFFECTS = ['slam', 'loud', 'gentle', 'invisible'];

/**
 * Dispatches an SMS/iMessage via the Linq REST API or simulated test transport.
 */
export async function sendLinqMessage(options: SendLinqMessageOptions): Promise<LinqSendResult> {
  const config = getLinqConfig();
  const to = normalizePhoneNumber(options.to);

  if (!config.isConfigured) {
    return {
      success: false,
      reason: 'not_configured',
      error: 'Linq API token is not configured. Set LINQ_API_TOKEN in your environment or log in via linq CLI.',
    };
  }

  let effectPayload: { type: 'screen' | 'bubble'; name: string } | undefined;
  if (options.effect) {
    if (SCREEN_EFFECTS.includes(options.effect)) {
      effectPayload = { type: 'screen', name: options.effect };
    } else if (BUBBLE_EFFECTS.includes(options.effect)) {
      effectPayload = { type: 'bubble', name: options.effect };
    }
  }

  const parts: Array<{ type: 'text'; value: string } | { type: 'media'; url: string }> = [
    { type: 'text', value: options.message },
  ];
  if (options.attachmentUrl) {
    parts.push({ type: 'media', url: options.attachmentUrl });
  }

  try {
    // Call the Linq chats creation endpoint
    const response = await fetch(`${config.apiBaseUrl}/chats`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.phoneNumber,
        to: [to],
        message: {
          parts,
          ...(effectPayload ? { effect: effectPayload } : {}),
          ...(options.replyToMessageId ? { replyToMessageId: options.replyToMessageId } : {}),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Linq API error (${response.status}): ${errorText}`,
      };
    }

    const data = await response.json() as {
      chat?: { id?: string; message?: { id?: string } };
      messageId?: string;
      chatId?: string;
      id?: string;
    };

    return {
      success: true,
      chatId: data.chat?.id || data.chatId,
      messageId: data.chat?.message?.id || data.messageId || data.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown network error when communicating with Linq API',
    };
  }
}

/**
 * Sends a rich Real Estate Listing alert over iMessage with visual effects and photo attachments.
 */
export async function sendListingAlertMessage(params: {
  to: string;
  property: ListingAlertData;
  groupName?: string;
  customNote?: string;
  effect?: LinqEffect;
}): Promise<LinqSendResult> {
  const { property, groupName, customNote, effect = 'sparkles' } = params;

  const priceFormatted = property.price ? `$${property.price.toLocaleString()}` : 'Price on request';
  const bedsBaths = [
    property.beds ? `${property.beds} bd` : null,
    property.baths ? `${property.baths} ba` : null,
    property.sqft ? `${property.sqft.toLocaleString()} sqft` : null,
  ].filter(Boolean).join(' • ');

  const location = [property.city, property.state, property.zip].filter(Boolean).join(', ');

  const lines = [
    `🏡 Home Buyer Sync Alert`,
    groupName ? `Search: ${groupName}` : null,
    `📍 ${property.address}${location ? ` (${location})` : ''}`,
    `💰 ${priceFormatted}${bedsBaths ? ` | ${bedsBaths}` : ''}`,
    customNote ? `\n💬 Note: ${customNote}` : null,
    property.url ? `\n🔗 View: ${property.url}` : null,
  ].filter(Boolean);

  const message = lines.join('\n');
  const attachmentUrl = property.photos?.[0];

  return sendLinqMessage({
    to: params.to,
    message,
    effect,
    attachmentUrl,
  });
}

/**
 * Sends a collaborative score or decision reveal alert.
 */
export async function sendDecisionAlertMessage(params: {
  to: string;
  propertyAddress: string;
  score: number | null;
  status: string;
  groupName?: string;
  effect?: LinqEffect;
}): Promise<LinqSendResult> {
  const { propertyAddress, score, status, groupName, effect = 'celebration' } = params;

  const scoreText = score !== null ? `${Math.round(score)} / 100` : 'Pending team reveal';
  const lines = [
    `📊 Home Decision Update`,
    groupName ? `Search: ${groupName}` : null,
    `📍 ${propertyAddress}`,
    `⭐ Team Score: ${scoreText}`,
    `🎯 Status: ${status.toUpperCase()}`,
  ].filter(Boolean);

  return sendLinqMessage({
    to: params.to,
    message: lines.join('\n'),
    effect,
  });
}

/**
 * Sends an invitation to join a Buyer Group over iMessage / SMS.
 */
export async function sendInvitationSmsMessage(params: {
  to: string;
  inviterName: string;
  searchName: string;
  inviteLink: string;
  expiresAt: Date;
}): Promise<LinqSendResult> {
  const { inviterName, searchName, inviteLink, expiresAt } = params;
  const expiration = expiresAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const message = `👋 ${inviterName} invited you to collaborate on "${searchName}" on Home Buyer Sync!\n\nJoin the search: ${inviteLink}\n(Link expires ${expiration})`;

  return sendLinqMessage({
    to: params.to,
    message,
    effect: 'confetti',
  });
}

/**
 * Adds or removes a reaction on a Linq message.
 */
export async function reactToLinqMessage(params: {
  messageId: string;
  type: LinqReactionType;
  emoji?: string;
  operation?: 'add' | 'remove';
}): Promise<{ success: boolean; error?: string }> {
  const config = getLinqConfig();
  if (!config.isConfigured) {
    return { success: false, error: 'Linq API token is not configured.' };
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/messages/${params.messageId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: params.type,
        emoji: params.emoji,
        operation: params.operation || 'add',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Linq API error (${response.status}): ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Reaction failed' };
  }
}

/**
 * Activates or deactivates the typing bubble indicator in an active chat.
 */
export async function setLinqTypingIndicator(params: {
  chatId: string;
  stop?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const config = getLinqConfig();
  if (!config.isConfigured) {
    return { success: false, error: 'Linq API token is not configured.' };
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/chats/${params.chatId}/typing`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stop: Boolean(params.stop),
      }),
    });

    return { success: response.ok };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Typing update failed' };
  }
}

/**
 * Verifies Linq webhook signature using HMAC-SHA256 if secret is set.
 */
export function verifyLinqWebhookSignature(params: {
  payload: string | Buffer;
  signature?: string;
  secret?: string | null;
  timestamp?: string;
}): boolean {
  const secret = params.secret ?? getLinqConfig().webhookSecret;
  if (!secret) {
    // If no secret configured, accept the webhook in development/unsecured mode
    return true;
  }

  if (!params.signature) {
    return false;
  }

  try {
    const stringPayload = typeof params.payload === 'string' ? params.payload : params.payload.toString('utf8');
    const signedPayload = params.timestamp ? `${params.timestamp}.${stringPayload}` : stringPayload;
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const expectedBuffer = Buffer.from(computedSignature, 'utf8');
    const signatureBuffer = Buffer.from(params.signature, 'utf8');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

/**
 * Normalizes and extracts structured information from an incoming Linq webhook event payload.
 */
export function parseLinqWebhookEvent(body: any): LinqWebhookEvent {
  const type = body?.type || body?.event || 'message.received';
  const data = body?.data || body?.payload || body;

  const sender = data?.from || data?.sender?.phone || data?.senderNumber || data?.chat?.participantNumber || '';
  const text = data?.text || data?.message?.text || data?.message || data?.body || '';
  const chatId = data?.chatId || data?.chat?.id || '';
  const messageId = data?.messageId || data?.message?.id || data?.id || '';

  return {
    id: body?.id || messageId,
    type,
    createdAt: body?.createdAt || new Date().toISOString(),
    data: {
      ...data,
      from: sender,
      text,
      chatId,
      messageId,
      isFromMe: Boolean(data?.isFromMe),
    },
  };
}

/**
 * Strips raw markdown syntax that can look cluttered in plain SMS/iMessage texts.
 */
export function cleanSmsMarkdown(text: string): string {
  let cleaned = text
    .replace(/^#{1,6}\s+/gm, '') // remove markdown heading hashes
    .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold asterisks for clean SMS readability
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)') // format links nicely
    .trim();
  if (cleaned.length > 1500) {
    cleaned = cleaned.slice(0, 1450).trim() + '...\n\n(View full details in the Home Buyer Sync app)';
  }
  return cleaned;
}

/**
 * Formats an LLM / assistant turn result into a clear, helpful SMS response.
 */
export function formatSmsChatbotResponse(
  turnResult: AssistantTurnResult,
  rawText: string,
  activeGroup?: any,
): string {
  if (!turnResult.reducedCapability && turnResult.content) {
    return cleanSmsMarkdown(turnResult.content);
  }

  // If reduced capability (deterministic fallback mode):
  const criteriaUpdated = turnResult.toolSummaries?.find(
    s => s.toolName === 'update_search_criteria' && s.status === 'succeeded'
  );
  if (criteriaUpdated) {
    return `🏡 Criteria Updated: I have updated your search preferences in your workspace!\n\nText 'status' to review your updated criteria or 'top' for your shortlist.`;
  }

  // Check if live listings were found
  const searchSummary = turnResult.toolSummaries?.find(
    s => s.toolName === 'search_listings' && s.status === 'succeeded'
  );
  if (searchSummary) {
    const matches = turnResult.content.match(/Live matching listings:\s*(\[.*?\])/s);
    if (matches && matches[1]) {
      try {
        const parsed = JSON.parse(matches[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const items = parsed.slice(0, 3).map((p: any, i: number) => {
            const price = p.price ? `$${p.price.toLocaleString()}` : 'N/A';
            const beds = p.beds ? `${p.beds}bd` : '';
            const baths = p.baths ? `${p.baths}ba` : '';
            const specs = [beds, baths].filter(Boolean).join('/');
            return `${i + 1}. ${p.address || p.formattedAddress} — ${price}${specs ? ` (${specs})` : ''}`;
          }).join('\n');
          return `🔍 Found Listings Matching Your Request:\n\n${items}\n\nLog in to Home Buyer Sync to inspect and score them!`;
        }
      } catch {
        // Fall through
      }
    }
  }

  // Helpful conversational assistant reply based on group context
  const location = activeGroup?.searchCriteria?.location || 'your search area';
  return `🏡 Home Buyer Sync Assistant:\n\n` +
    `I received your question: "${rawText.slice(0, 80)}".\n\n` +
    `I can help you analyze listings in ${location}, compare saved properties, check mortgage rates, or refine your criteria.\n\n` +
    `• Text 'status' for your search criteria\n` +
    `• Text 'top' for your saved shortlist\n` +
    `• Text 'search <city/zip>' to discover homes\n` +
    `• Or reply with any real estate question!`;
}

export interface ProcessInboundLinqOptions {
  provider?: AssistantProvider | null;
}

/**
 * Handles incoming conversational iMessage/SMS queries and dispatches intelligent auto-replies.
 */
export async function processInboundLinqMessage(
  event: LinqWebhookEvent,
  db: PrismaClient,
  options?: ProcessInboundLinqOptions,
): Promise<{ handled: boolean; replySent: boolean; replyText?: string }> {
  // If the message is outgoing (sent by us), skip to prevent infinite echo loops
  if (event.data.isFromMe) {
    return { handled: false, replySent: false };
  }

  const sender = event.data.from;
  const rawText = (event.data.text || '').trim();

  if (!sender || !rawText) {
    return { handled: false, replySent: false };
  }

  const normalizedSender = normalizePhoneNumber(sender);
  const command = rawText.toLowerCase();

  // Find user(s) matching phone number (both normalized and raw)
  let users: any[] = [];
  if (typeof db.user?.findMany === 'function') {
    users = await db.user.findMany({
      where: {
        OR: [
          { phone: normalizedSender },
          { phone: sender },
        ],
      },
      include: {
        memberships: {
          include: {
            group: {
              include: {
                searchCriteria: true,
                properties: {
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
    });
  } else if (typeof db.user?.findFirst === 'function') {
    const singleUser = await db.user.findFirst({
      where: {
        OR: [
          { phone: normalizedSender },
          { phone: sender },
        ],
      },
      include: {
        memberships: {
          include: {
            group: {
              include: {
                searchCriteria: true,
                properties: {
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
    });
    if (singleUser) {
      users = [singleUser];
    }
  }

  const userGroups = users.flatMap(u => u.memberships.map(m => m.group)).filter(Boolean);
  const userGroupIds = [...new Set(userGroups.map(g => g.id))];

  // Pick active group: prefer group with properties or criteria, or first group, or fallback to any buyer group in db
  let activeGroup = userGroups.find(g => g.properties && g.properties.length > 0) ||
    userGroups.find(g => g.searchCriteria && (g.searchCriteria.location || g.searchCriteria.maxPrice)) ||
    userGroups[0];

  if (!activeGroup) {
    activeGroup = (await db.buyerGroup.findFirst({
      include: {
        searchCriteria: true,
        properties: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })) || undefined;
  }

  let replyText = '';

  const isSearchCommand =
    command === 'search' ||
    command === 'find' ||
    command === 'discover' ||
    command.startsWith('search ') ||
    command.startsWith('search:') ||
    command.startsWith('find ') ||
    command.startsWith('find:') ||
    command.startsWith('discover ') ||
    command.startsWith('homes in ') ||
    command.startsWith('listings in ') ||
    command.startsWith('show homes in ');

  if (command === 'help' || command === 'commands' || command === '?') {
    replyText = `📱 Home Buyer Sync Assistant Commands:\n\n` +
      `• status: View your active search criteria & saved homes count\n` +
      `• top: List your recent saved homes & prices\n` +
      `• search <city/zip>: Search saved homes or discover live listings (e.g. 'search Atlanta' or 'search 30080')\n` +
      `• help: Show this command list\n\n` +
      `You can also reply with any question about your home search!`;
  } else if (command === 'status' || command === 'summary' || command === 'criteria') {
    if (!activeGroup) {
      replyText = `No active home search group found. Log in to Home Buyer Sync to set up your criteria.`;
    } else {
      const criteria = activeGroup.searchCriteria;
      const budgetText = criteria?.maxPrice ? `up to $${criteria.maxPrice.toLocaleString()}` : 'No max budget set';
      const bedsText = criteria?.minBeds ? `${criteria.minBeds}+ beds` : 'Any beds';
      const locText = criteria?.location || 'Any location';
      const propCount = activeGroup.properties?.length ?? 0;

      replyText = `🏡 ${activeGroup.name} Status:\n` +
        `📍 Location: ${locText}\n` +
        `💰 Budget: ${budgetText}\n` +
        `🛏️ Rooms: ${bedsText}\n` +
        `⭐ Saved Properties: ${propCount}\n\n` +
        `Text 'top' to see your recent shortlist or 'search <city>' to explore listings!`;
    }
  } else if (command === 'top' || command === 'saved' || command === 'properties' || command === 'shortlist' || command === 'favorites') {
    const allProperties = activeGroup?.properties || [];
    if (!activeGroup || allProperties.length === 0) {
      replyText = `No saved properties found in ${activeGroup?.name || 'your search'}. Discover and save homes in the app or text 'search <city>'!`;
    } else {
      const items = allProperties.slice(0, 5).map((p, i) => {
        const price = p.price ? `$${p.price.toLocaleString()}` : 'N/A';
        const beds = p.beds ? `${p.beds}bd` : '';
        const baths = p.baths ? `${p.baths}ba` : '';
        const specs = [beds, baths].filter(Boolean).join('/');
        return `${i + 1}. ${p.address} (${price}${specs ? `, ${specs}` : ''})`;
      }).join('\n');

      replyText = `⭐ Top Saved Properties for ${activeGroup.name}:\n\n${items}`;
    }
  } else if (isSearchCommand) {
    const rawQuery = rawText
      .replace(/^(search|find|discover|show homes in|homes in|listings in)\s*[:,\s]*/i, '')
      .trim();
    const query = rawQuery.toLowerCase();

    if (!query) {
      // User sent just "search" or "find" without a location
      const location = activeGroup?.searchCriteria?.location;
      if (location) {
        replyText = `🔍 Home Search for ${activeGroup?.name || 'your group'}:\n` +
          `Active location: ${location}\n\n` +
          `Text "search ${location}" or "search <city/zip>" (e.g. "search Atlanta" or "search 30301") to explore listings!`;
      } else {
        replyText = `🔍 Search Homes:\n\nText 'search <city/zip>' (e.g. 'search Atlanta' or 'search 30301') to find matching saved properties or discover live listings.`;
      }
    } else {
      // Step 1: Search saved properties across user's buyer group(s) or activeGroup
      let savedMatches: Array<{ address: string; price: number | null; beds: number | null; baths: number | null; city: string | null }> = [];

      try {
        if (db.property?.findMany) {
          const groupFilter = userGroupIds.length > 0 ? { groupId: { in: userGroupIds } } : activeGroup ? { groupId: activeGroup.id } : {};
          const dbProps = await db.property.findMany({
            where: {
              ...groupFilter,
              OR: [
                { address: { contains: query } },
                { city: { contains: query } },
                { state: { contains: query } },
                { zip: { contains: query } },
                { notes: { contains: query } },
                { propertyType: { contains: query } },
              ],
            },
            take: 5,
            orderBy: { createdAt: 'desc' },
          });
          savedMatches = dbProps;
        }
      } catch {
        // Fall back to filtering activeGroup properties in memory if DB findMany fails or in test mocks
      }

      if (savedMatches.length === 0 && activeGroup?.properties) {
        savedMatches = activeGroup.properties.filter(p =>
          p.address.toLowerCase().includes(query) ||
          (p.city && p.city.toLowerCase().includes(query)) ||
          (p.notes && p.notes.toLowerCase().includes(query))
        );
      }

      if (savedMatches.length > 0) {
        const items = savedMatches.slice(0, 4).map((p, i) => {
          const price = p.price ? `$${p.price.toLocaleString()}` : 'N/A';
          const beds = p.beds ? `${p.beds}bd` : '';
          const baths = p.baths ? `${p.baths}ba` : '';
          const specs = [beds, baths].filter(Boolean).join('/');
          return `${i + 1}. ${p.address} (${price}${specs ? ` | ${specs}` : ''})`;
        }).join('\n');
        replyText = `⭐ Saved Property Matches for "${rawQuery}":\n\n${items}`;
      } else {
        // Step 2: If no saved properties matched, attempt live public listing discovery
        let liveListings: Array<{ address: string; price?: number | null; beds?: number | null; baths?: number | null }> = [];
        try {
          const discoveries = await searchPublicListings({ location: rawQuery, limit: 3 });
          if (Array.isArray(discoveries) && discoveries.length > 0) {
            liveListings = discoveries;
          }
        } catch {
          // If public listing provider is not configured or fails, fallback cleanly
        }

        if (liveListings.length > 0) {
          const items = liveListings.map((p, i) => {
            const price = p.price ? `$${p.price.toLocaleString()}` : 'N/A';
            const beds = p.beds ? `${p.beds}bd` : '';
            const baths = p.baths ? `${p.baths}ba` : '';
            const specs = [beds, baths].filter(Boolean).join('/');
            return `${i + 1}. ${p.address} — ${price}${specs ? ` (${specs})` : ''}`;
          }).join('\n');
          replyText = `🔍 Discovered Listings in "${rawQuery}":\n\n${items}\n\nLog in to Home Buyer Sync to save and score these homes!`;
        } else {
          replyText = `No properties found matching "${rawQuery}". Try searching by city or zip code (e.g. 'search Atlanta' or 'search 30080'), or text 'top' for your saved shortlist.`;
        }
      }
    }
  } else {
    // Conversational Chatbot Turn with LLM Orchestrator
    const primaryUser = users[0];
    const userId = primaryUser?.id || activeGroup?.createdById || 'sms-user';
    const groupId = activeGroup?.id || 'sms-group';

    // 1. Find or create an SMS Assistant Thread
    let thread: any = null;
    try {
      if (typeof db.assistantThread?.findFirst === 'function') {
        thread = await db.assistantThread.findFirst({
          where: {
            groupId,
            title: 'SMS Chatbot Conversation',
          },
          orderBy: { updatedAt: 'desc' },
        });
      }
      if (!thread && typeof db.assistantThread?.create === 'function') {
        thread = await db.assistantThread.create({
          data: {
            groupId,
            createdById: userId,
            title: 'SMS Chatbot Conversation',
          },
        });
      }
    } catch {
      // Ignore thread lookup/creation errors in lightweight mocks
    }

    const threadId = thread?.id || `sms-thread-${groupId}`;

    // 2. Retrieve recent conversation history for multi-turn conversational context
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    try {
      if (thread && typeof db.assistantMessage?.findMany === 'function') {
        const recent = await db.assistantMessage.findMany({
          where: {
            threadId: thread.id,
            role: { in: ['user', 'assistant'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        history = recent.reverse().map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      }
    } catch {
      // Ignore history retrieval errors
    }

    // 3. Record incoming user message
    let userMessageId = randomUUID();
    try {
      if (thread && typeof db.assistantMessage?.create === 'function') {
        const createdMsg = await db.assistantMessage.create({
          data: {
            groupId,
            threadId,
            authorId: primaryUser?.id,
            role: 'user',
            content: rawText,
          },
        });
        userMessageId = createdMsg.id;
      }
    } catch {
      // Ignore message record error in mocks
    }

    // 4. Setup MCP tool registry and execution context
    const registry = createMcpToolRegistry({ writeBudget: 2 });
    const turnId = randomUUID();
    const context: McpExecutionContext = {
      db,
      userId,
      groupId,
      threadId,
      messageId: userMessageId,
      turnId,
    };

    const executor: AssistantToolExecutor = {
      definitions: () => registry.definitions.map(def => ({
        name: def.name,
        description: def.description,
        inputSchema: z.toJSONSchema(def.inputSchema) as Record<string, unknown>,
        isWrite: def.isWrite,
      } satisfies AssistantToolDefinition)),
      execute: async (name, toolInput) => {
        const def = registry.definitions.find(item => item.name === name);
        if (!def) throw new Error(`Unknown assistant tool: ${name}`);
        const res = await registry.execute(name as ToolName, toolInput, context);
        const direction = def.isWrite ? 'completed; update saved to workspace' : 'completed';
        return { data: res.data, citations: res.citations, summary: `${name} ${direction}` };
      },
    };

    // 5. Run assistant turn with provider (Gemini or injected test provider)
    const provider = options?.provider !== undefined ? options.provider : createGeminiProvider();
    let turnResult: AssistantTurnResult;
    try {
      turnResult = await runAssistantTurn(
        rawText,
        history,
        provider,
        executor,
        { maxToolCalls: 4, maxOutputTokens: 800 },
      );
    } catch (err) {
      console.error('[linq] Assistant conversational turn error:', err);
      turnResult = {
        content: `I received your message: "${rawText.slice(0, 80)}". How can I assist with your home search today?`,
        citations: [],
        toolSummaries: [],
        reducedCapability: true,
      };
    }

    replyText = formatSmsChatbotResponse(turnResult, rawText, activeGroup);

    // 6. Record assistant response in database
    try {
      if (thread && typeof db.assistantMessage?.create === 'function') {
        await db.assistantMessage.create({
          data: {
            groupId,
            threadId,
            role: 'assistant',
            content: replyText,
            citations: JSON.stringify(turnResult.citations || []),
            toolSummaries: JSON.stringify(turnResult.toolSummaries || []),
            provider: turnResult.provider || null,
            model: turnResult.model || null,
            inputTokens: turnResult.inputTokens || null,
            outputTokens: turnResult.outputTokens || null,
            totalTokens: (turnResult.inputTokens || 0) + (turnResult.outputTokens || 0) || null,
          },
        });
      }
      if (thread && typeof db.assistantThread?.update === 'function') {
        await db.assistantThread.update({
          where: { id: thread.id },
          data: { lastMessageAt: new Date() },
        });
      }
    } catch {
      // Ignore logging errors in mocks
    }
  }

  const sendResult = await sendLinqMessage({
    to: normalizedSender,
    message: replyText,
    effect: 'gentle',
  });

  return {
    handled: true,
    replySent: sendResult.success,
    replyText,
  };
}
