import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import { createLinqRouter } from './linq';

function createTestApp(db: PrismaClient, userId = 'user-1') {
  const app = express();
  app.use(express.json());

  const linqRouter = createLinqRouter(db);

  // Mount with auth middleware simulating session
  app.use('/api/linq', (req: any, _res, next) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.userId = userId;
    }
    next();
  }, linqRouter);

  return app;
}

test('GET /api/linq/status returns configuration metadata and listener status without authentication', async () => {
  const fakeDb = {} as PrismaClient;
  const app = createTestApp(fakeDb);

  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://localhost:${port}/api/linq/status`);
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.ok(typeof data.configured === 'boolean');
    assert.ok(typeof data.phoneNumber === 'string');
    assert.ok(typeof data.apiBaseUrl === 'string');
    assert.ok(typeof data.listener === 'object');
    assert.equal(typeof data.listener.running, 'boolean');
  } finally {
    server.close();
  }
});

test('POST /api/linq accepts webhook event payload on root router path and returns 200', async () => {
  const fakeDb = {
    user: { findFirst: async () => null },
    buyerGroup: { findFirst: async () => null },
  } as unknown as PrismaClient;

  const app = createTestApp(fakeDb);
  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://localhost:${port}/api/linq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message.received',
        data: {
          from: '+17704904583',
          text: 'Hello bot on root',
          isFromMe: false,
        },
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.equal(data.status, 'ok');
    assert.equal(data.received, true);
  } finally {
    server.close();
  }
});

test('POST /api/linq/webhook accepts webhook event payload and returns 200', async () => {
  const fakeDb = {
    user: { findFirst: async () => null },
    buyerGroup: { findFirst: async () => null },
  } as unknown as PrismaClient;

  const app = createTestApp(fakeDb);
  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://localhost:${port}/api/linq/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message.received',
        data: {
          from: '+17704904583',
          text: 'Hello bot',
          isFromMe: false,
        },
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.equal(data.status, 'ok');
    assert.equal(data.received, true);
  } finally {
    server.close();
  }
});

test('POST /api/linq/send requires authentication and rejects unauthorized callers', async () => {
  const fakeDb = {} as PrismaClient;
  const app = createTestApp(fakeDb);
  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://localhost:${port}/api/linq/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: '+17704904583',
        message: 'Hello',
      }),
    });

    assert.equal(res.status, 401);
    const data = await res.json() as any;
    assert.match(data.error, /Authentication required/);
  } finally {
    server.close();
  }
});

test('POST /api/linq/alert-listing validates property ownership and sends alert', async () => {
  const fakeDb = {
    groupMembership: {
      findFirst: async () => ({
        id: 'member-1',
        userId: 'user-1',
        groupId: 'group-1',
        role: 'buyer',
        status: 'accepted',
      }),
    },
    property: {
      findFirst: async () => ({
        id: 'prop-1',
        groupId: 'group-1',
        address: '100 Peachtree St',
        city: 'Atlanta',
        state: 'GA',
        zip: '30303',
        price: 495000,
        beds: 3,
        baths: 2,
        sqft: 1800,
        photos: '["https://example.com/photo.jpg"]',
        sourceUrl: 'https://example.com/listing/1',
        group: { name: 'Atlanta Search' },
      }),
    },
  } as unknown as PrismaClient;

  const originalFetch = globalThis.fetch;
  const dispatchedRequests: any[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    if (typeof url === 'string' && url.includes('api.linqapp.com')) {
      dispatchedRequests.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({
        chat: { id: 'chat-mock-123', message: { id: 'msg-mock-456' } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, init);
  }) as any;

  const app = createTestApp(fakeDb, 'user-1');
  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const res = await originalFetch(`http://localhost:${port}/api/linq/alert-listing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token',
      },
      body: JSON.stringify({
        to: '+17704904583',
        propertyId: 'prop-1',
        customNote: 'Check this new home out!',
        effect: 'confetti',
      }),
    });

    const data = await res.json() as any;
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.chatId, 'chat-mock-123');
    assert.equal(data.messageId, 'msg-mock-456');
    assert.equal(dispatchedRequests.length, 1);
    assert.match(dispatchedRequests[0].body.message.parts[0].value, /100 Peachtree St/);
  } finally {
    globalThis.fetch = originalFetch;
    server.close();
  }
});

test('POST /api/linq/alert-decision validates property ownership and dispatches decision update', async () => {
  const fakeDb = {
    groupMembership: {
      findFirst: async () => ({
        id: 'member-1',
        userId: 'user-1',
        groupId: 'group-1',
        role: 'buyer',
        status: 'accepted',
      }),
    },
    property: {
      findFirst: async () => ({
        id: 'prop-1',
        groupId: 'group-1',
        address: '100 Peachtree St',
        compositeScore: 92,
        status: 'top_contender',
        group: { name: 'Atlanta Search' },
      }),
    },
  } as unknown as PrismaClient;

  const originalFetch = globalThis.fetch;
  const dispatchedRequests: any[] = [];
  globalThis.fetch = (async (url: any, init: any) => {
    if (typeof url === 'string' && url.includes('api.linqapp.com')) {
      dispatchedRequests.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({
        chat: { id: 'chat-mock-decision', message: { id: 'msg-mock-decision' } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, init);
  }) as any;

  const app = createTestApp(fakeDb, 'user-1');
  const server = app.listen(0);
  const port = (server.address() as any).port;

  try {
    const res = await originalFetch(`http://localhost:${port}/api/linq/alert-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token',
      },
      body: JSON.stringify({
        to: '+17704904583',
        propertyId: 'prop-1',
        effect: 'celebration',
      }),
    });

    const data = await res.json() as any;
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.chatId, 'chat-mock-decision');
    assert.equal(dispatchedRequests.length, 1);
    assert.match(dispatchedRequests[0].body.message.parts[0].value, /92 \/ 100/);
    assert.match(dispatchedRequests[0].body.message.parts[0].value, /TOP_CONTENDER/);
  } finally {
    globalThis.fetch = originalFetch;
    server.close();
  }
});
