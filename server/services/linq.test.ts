import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import {
  normalizePhoneNumber,
  getLinqConfig,
  sendListingAlertMessage,
  sendDecisionAlertMessage,
  sendInvitationSmsMessage,
  verifyLinqWebhookSignature,
  parseLinqWebhookEvent,
  processInboundLinqMessage,
} from './linq';

test('normalizePhoneNumber handles various domestic and international formats', () => {
  assert.equal(normalizePhoneNumber('4155551234'), '+14155551234');
  assert.equal(normalizePhoneNumber('(415) 555-1234'), '+14155551234');
  assert.equal(normalizePhoneNumber('14155551234'), '+14155551234');
  assert.equal(normalizePhoneNumber('+14155551234'), '+14155551234');
  assert.equal(normalizePhoneNumber('+44 7700 900123'), '+447700900123');
});

test('getLinqConfig returns default config object', () => {
  const config = getLinqConfig();
  assert.ok(typeof config === 'object');
  assert.ok(typeof config.phoneNumber === 'string');
  assert.ok(typeof config.apiBaseUrl === 'string');
});

test('verifyLinqWebhookSignature properly validates HMAC-SHA256 signatures', () => {
  const secret = 'test-secret-key-12345';
  const payload = JSON.stringify({ type: 'message.received', data: { text: 'hi' } });
  const timestamp = '1770000000';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  // Valid signature
  assert.equal(
    verifyLinqWebhookSignature({ payload, signature, secret, timestamp }),
    true,
  );

  // Invalid signature
  assert.equal(
    verifyLinqWebhookSignature({ payload, signature: 'invalid-sig', secret, timestamp }),
    false,
  );

  // Altered payload
  assert.equal(
    verifyLinqWebhookSignature({ payload: '{"altered":true}', signature, secret, timestamp }),
    false,
  );

  // No secret configured accepts in development mode
  assert.equal(
    verifyLinqWebhookSignature({ payload, secret: null }),
    true,
  );
});

test('parseLinqWebhookEvent extracts normalized event payload', () => {
  const rawEvent = {
    id: 'evt_123',
    type: 'message.received',
    data: {
      chatId: 'chat-abc',
      messageId: 'msg-xyz',
      from: '+17704904583',
      text: 'What homes are on my shortlist?',
      isFromMe: false,
    },
  };

  const parsed = parseLinqWebhookEvent(rawEvent);
  assert.equal(parsed.type, 'message.received');
  assert.equal(parsed.data.chatId, 'chat-abc');
  assert.equal(parsed.data.messageId, 'msg-xyz');
  assert.equal(parsed.data.from, '+17704904583');
  assert.equal(parsed.data.text, 'What homes are on my shortlist?');
  assert.equal(parsed.data.isFromMe, false);
});

test('processInboundLinqMessage ignores outgoing messages', async () => {
  const fakeDb = {} as PrismaClient;
  const event = {
    type: 'message.received',
    data: {
      isFromMe: true,
      from: '+17704904583',
      text: 'Outgoing echo',
    },
  };

  const result = await processInboundLinqMessage(event, fakeDb);
  assert.equal(result.handled, false);
  assert.equal(result.replySent, false);
});

test('processInboundLinqMessage processes help, status, top, and various search queries', async () => {
  const fakeDb = {
    user: {
      findMany: async () => [
        {
          id: 'user-1',
          name: 'David Robertson',
          phone: '+17704904583',
          memberships: [
            {
              group: {
                id: 'group-1',
                name: 'Smyrna Dream Homes',
                searchCriteria: {
                  location: 'Smyrna, GA',
                  maxPrice: 650000,
                  minBeds: 3,
                },
                properties: [
                  {
                    id: 'prop-1',
                    address: '123 Main St',
                    city: 'Smyrna',
                    price: 550000,
                    beds: 3,
                    baths: 2,
                    notes: 'Close to park',
                  },
                ],
              },
            },
          ],
        },
      ],
      findFirst: async () => null,
    },
    buyerGroup: {
      findFirst: async () => null,
    },
    property: {
      findMany: async (args: any) => {
        const contains = args?.where?.OR?.[0]?.address?.contains || '';
        if (contains.includes('smyrna') || contains.includes('123')) {
          return [
            {
              id: 'prop-1',
              address: '123 Main St',
              city: 'Smyrna',
              price: 550000,
              beds: 3,
              baths: 2,
              notes: 'Close to park',
            },
          ];
        }
        return [];
      },
    },
  } as unknown as PrismaClient;

  // Test 'help'
  const helpResult = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: { from: '+17704904583', text: 'help', isFromMe: false },
    },
    fakeDb,
  );
  assert.equal(helpResult.handled, true);
  assert.match(helpResult.replyText || '', /Home Buyer Sync Assistant Commands/);

  // Test 'status'
  const statusResult = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: { from: '+17704904583', text: 'status', isFromMe: false },
    },
    fakeDb,
  );
  assert.equal(statusResult.handled, true);
  assert.match(statusResult.replyText || '', /Smyrna Dream Homes Status/);
  assert.match(statusResult.replyText || '', /Smyrna, GA/);
  assert.match(statusResult.replyText || '', /\$650,000/);

  // Test 'top'
  const topResult = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: { from: '+17704904583', text: 'top', isFromMe: false },
    },
    fakeDb,
  );
  assert.equal(topResult.handled, true);
  assert.match(topResult.replyText || '', /Top Saved Properties/);
  assert.match(topResult.replyText || '', /123 Main St/);

  // Test bare 'search'
  const bareSearchResult = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: { from: '+17704904583', text: 'search', isFromMe: false },
    },
    fakeDb,
  );
  assert.equal(bareSearchResult.handled, true);
  assert.match(bareSearchResult.replyText || '', /Home Search for Smyrna Dream Homes/);
  assert.match(bareSearchResult.replyText || '', /Smyrna, GA/);

  // Test 'search smyrna' (saved property match)
  const searchResult = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: { from: '+17704904583', text: 'search smyrna', isFromMe: false },
    },
    fakeDb,
  );
  assert.equal(searchResult.handled, true);
  assert.match(searchResult.replyText || '', /Saved Property Matches for "smyrna"/);
  assert.match(searchResult.replyText || '', /123 Main St/);

  // Test 'find: 123'
  const findResult = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: { from: '+17704904583', text: 'find: 123', isFromMe: false },
    },
    fakeDb,
  );
  assert.equal(findResult.handled, true);
  assert.match(findResult.replyText || '', /Saved Property Matches for "123"/);
  assert.match(findResult.replyText || '', /123 Main St/);

  // Test 'search nonexistent_city_xyz' (fallback message)
  const noMatchResult = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: { from: '+17704904583', text: 'search nonexistent_city_xyz', isFromMe: false },
    },
    fakeDb,
  );
  assert.equal(noMatchResult.handled, true);
  assert.match(noMatchResult.replyText || '', /No properties found matching/);

  // Test natural language 'homes in Smyrna'
  const nlResult = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: { from: '+17704904583', text: 'homes in Smyrna', isFromMe: false },
    },
    fakeDb,
  );
  assert.equal(nlResult.handled, true);
  assert.match(nlResult.replyText || '', /Saved Property Matches for "Smyrna"/);
});

test('processInboundLinqMessage handles users with multiple groups gracefully', async () => {
  const fakeDb = {
    user: {
      findMany: async () => [
        {
          id: 'user-1',
          name: 'David Robertson',
          phone: '+17704904583',
          memberships: [
            {
              group: {
                id: 'empty-group',
                name: "Empty Home Search",
                searchCriteria: null,
                properties: [],
              },
            },
            {
              group: {
                id: 'active-group',
                name: 'Active Search Group',
                searchCriteria: { location: 'Atlanta, GA', maxPrice: 750000 },
                properties: [
                  {
                    id: 'prop-atl-1',
                    address: '500 Peachtree St',
                    city: 'Atlanta',
                    price: 620000,
                    beds: 3,
                    baths: 2,
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    property: {
      findMany: async () => [
        {
          id: 'prop-atl-1',
          address: '500 Peachtree St',
          city: 'Atlanta',
          price: 620000,
          beds: 3,
          baths: 2,
        },
      ],
    },
  } as unknown as PrismaClient;

  // Active group should be resolved to the one with properties/criteria
  const statusResult = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: { from: '+17704904583', text: 'status', isFromMe: false },
    },
    fakeDb,
  );
  assert.equal(statusResult.handled, true);
  assert.match(statusResult.replyText || '', /Active Search Group/);
  assert.match(statusResult.replyText || '', /Atlanta, GA/);

  // Search across multiple groups
  const searchResult = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: { from: '+17704904583', text: 'search Peachtree', isFromMe: false },
    },
    fakeDb,
  );
  assert.equal(searchResult.handled, true);
  assert.match(searchResult.replyText || '', /500 Peachtree St/);
});

test('processInboundLinqMessage executes conversational LLM chatbot turns over SMS', async () => {
  const createdMessages: any[] = [];
  const createdThreads: any[] = [];
  let updatedThreadLastMessageAt: Date | null = null;

  const fakeDb = {
    user: {
      findMany: async () => [
        {
          id: 'user-david',
          name: 'David Robertson',
          phone: '+17704904583',
          memberships: [
            {
              group: {
                id: 'group-100',
                name: 'Cobb County Search',
                createdById: 'user-david',
                searchCriteria: {
                  location: 'Smyrna, GA',
                  maxPrice: 600000,
                  minBeds: 3,
                },
                properties: [
                  {
                    id: 'prop-1',
                    address: '789 Oak Ave',
                    city: 'Smyrna',
                    price: 580000,
                    beds: 4,
                    baths: 3,
                  },
                ],
              },
            },
          ],
        },
      ],
      findFirst: async () => null,
    },
    buyerGroup: {
      findFirst: async () => null,
    },
    assistantThread: {
      findFirst: async () => null,
      create: async (args: any) => {
        const thread = { id: 'thread-sms-1', ...args.data };
        createdThreads.push(thread);
        return thread;
      },
      update: async (args: any) => {
        updatedThreadLastMessageAt = args.data.lastMessageAt;
        return { id: args.where.id };
      },
    },
    assistantMessage: {
      findMany: async () => [],
      create: async (args: any) => {
        const msg = { id: `msg-${createdMessages.length + 1}`, ...args.data };
        createdMessages.push(msg);
        return msg;
      },
    },
  } as unknown as PrismaClient;

  // Mock Assistant Provider that responds intelligently
  const mockProvider = {
    generate: async (request: any) => {
      assert.ok(request.messages.length > 0);
      return {
        content: `**Great question!** For a $600,000 budget in Smyrna, GA, you should look closely at HOA fees, school ratings in Cobb County, and recent comparable sales near 789 Oak Ave.`,
        toolCalls: [],
        provider: 'gemini-mock',
        model: 'gemini-test',
        inputTokens: 50,
        outputTokens: 40,
      };
    },
  };

  const result = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: {
        from: '+17704904583',
        text: 'What should we consider when looking at homes in Smyrna around our budget?',
        isFromMe: false,
      },
    },
    fakeDb,
    { provider: mockProvider },
  );

  assert.equal(result.handled, true);
  assert.equal(result.replySent, true);
  // Asterisks should be cleaned for clean SMS readability
  assert.match(result.replyText || '', /Great question! For a \$600,000 budget in Smyrna, GA/);
  assert.doesNotMatch(result.replyText || '', /\*\*Great question!\*\*/);

  // Verify database records
  assert.equal(createdThreads.length, 1);
  assert.equal(createdThreads[0].title, 'SMS Chatbot Conversation');

  // Verify both user message and assistant message were saved
  assert.equal(createdMessages.length, 2);
  assert.equal(createdMessages[0].role, 'user');
  assert.match(createdMessages[0].content, /What should we consider/);
  assert.equal(createdMessages[1].role, 'assistant');
  assert.match(createdMessages[1].content, /Great question!/);
  assert.ok(updatedThreadLastMessageAt !== null);
});

test('processInboundLinqMessage passes previous multi-turn conversation history to LLM', async () => {
  let receivedHistory: any[] = [];

  const fakeDb = {
    user: {
      findMany: async () => [
        {
          id: 'user-david',
          name: 'David Robertson',
          phone: '+17704904583',
          memberships: [
            {
              group: {
                id: 'group-100',
                name: 'Cobb County Search',
                createdById: 'user-david',
                searchCriteria: { location: 'Smyrna, GA' },
                properties: [],
              },
            },
          ],
        },
      ],
    },
    assistantThread: {
      findFirst: async () => ({
        id: 'thread-existing-1',
        groupId: 'group-100',
        createdById: 'user-david',
        title: 'SMS Chatbot Conversation',
      }),
      update: async () => ({ id: 'thread-existing-1' }),
    },
    assistantMessage: {
      findMany: async () => [
        {
          id: 'msg-prev-2',
          role: 'assistant',
          content: 'Your target location is Smyrna, GA with a budget of $600,000.',
          createdAt: new Date(Date.now() - 5000),
        },
        {
          id: 'msg-prev-1',
          role: 'user',
          content: 'What is our current target location?',
          createdAt: new Date(Date.now() - 10000),
        },
      ],
      create: async (args: any) => ({ id: 'new-msg', ...args.data }),
    },
  } as unknown as PrismaClient;

  const mockProvider = {
    generate: async (request: any) => {
      receivedHistory = request.messages;
      return {
        content: `I've noted that you want to expand your search to Vinings as well!`,
        toolCalls: [],
        provider: 'gemini-mock',
      };
    },
  };

  const result = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: {
        from: '+17704904583',
        text: 'Can we also consider Vinings nearby?',
        isFromMe: false,
      },
    },
    fakeDb,
    { provider: mockProvider },
  );

  assert.equal(result.handled, true);
  assert.match(result.replyText || '', /Vinings/);
  // Verify history included previous messages
  assert.ok(receivedHistory.length >= 3);
  const userFirstMsg = receivedHistory.find((m: any) => m.content.includes('target location'));
  assert.ok(userFirstMsg, 'Previous conversation context must be passed into assistant turn');
});

test('processInboundLinqMessage handles fallback gracefully when no LLM provider is configured', async () => {
  const fakeDb = {
    user: {
      findMany: async () => [
        {
          id: 'user-david',
          name: 'David Robertson',
          phone: '+17704904583',
          memberships: [
            {
              group: {
                id: 'group-100',
                name: 'Smyrna Dream Homes',
                searchCriteria: { location: 'Smyrna, GA', maxPrice: 650000 },
                properties: [],
              },
            },
          ],
        },
      ],
    },
    assistantThread: {
      findFirst: async () => null,
      create: async () => ({ id: 'thread-fb' }),
      update: async () => ({ id: 'thread-fb' }),
    },
    assistantMessage: {
      findMany: async () => [],
      create: async () => ({ id: 'msg-fb' }),
    },
  } as unknown as PrismaClient;

  // Passing null provider simulates offline or unconfigured Gemini API key
  const result = await processInboundLinqMessage(
    {
      type: 'message.received',
      data: {
        from: '+17704904583',
        text: 'Can you give me advice on negotiating closing costs with sellers?',
        isFromMe: false,
      },
    },
    fakeDb,
    { provider: null },
  );

  assert.equal(result.handled, true);
  assert.equal(result.replySent, true);
  assert.match(result.replyText || '', /Home Buyer Sync Assistant/);
  assert.match(result.replyText || '', /Smyrna, GA/);
  assert.match(result.replyText || '', /Text 'status'/);
});
