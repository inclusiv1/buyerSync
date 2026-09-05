import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInvitationMessage, buildInvitationWebmailDrafts, sendInvitationEmail } from './email';

test('builds an invitation email with the project and acceptance link', () => {
  const message = buildInvitationMessage({
    inviterName: 'Alex Morgan',
    inviterEmail: 'alex@example.com',
    searchName: 'North Shore',
    inviteLink: 'https://example.com/invite/token',
    expiresAt: new Date('2026-09-11T00:00:00.000Z'),
  });

  assert.match(message.subject, /North Shore/);
  assert.match(message.text, /https:\/\/example\.com\/invite\/token/);
  assert.match(message.html, /Accept invitation/);
  assert.match(message.html, /alex@example\.com/);
  assert.match(message.html, /September 11, 2026/);
});

test('escapes user-controlled values in invitation HTML', () => {
  const message = buildInvitationMessage({
    inviterName: '<script>alert(1)</script>',
    inviterEmail: 'alex@example.com',
    searchName: 'Homes & Condos',
    inviteLink: 'https://example.com/invite/token?a=1&b=2',
    expiresAt: new Date('2026-09-11T00:00:00.000Z'),
  });

  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /Homes &amp; Condos/);
  assert.match(message.html, /a=1&amp;b=2/);
});

test('builds browser-based webmail drafts containing the invitation', () => {
  const drafts = buildInvitationWebmailDrafts({
    to: 'friend@example.com',
    inviterName: 'Alex Morgan',
    inviterEmail: 'alex@example.com',
    searchName: 'North Shore',
    inviteLink: 'https://buyersync.onrender.com/invite/token',
    expiresAt: new Date('2026-09-11T00:00:00.000Z'),
  });

  assert.deepEqual(drafts.map((draft) => draft.provider), ['Gmail', 'Outlook', 'Yahoo Mail']);
  for (const draft of drafts) {
    const url = new URL(draft.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.searchParams.get('to'), 'friend@example.com');
    assert.match(url.searchParams.get('body') || '', /https:\/\/buyersync\.onrender\.com\/invite\/token/);
  }
});

test('reports that delivery is unavailable when SMTP is not configured', async () => {
  const previousHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;

  try {
    const result = await sendInvitationEmail({
      to: 'friend@example.com',
      inviterName: 'Alex Morgan',
      inviterEmail: 'alex@example.com',
      searchName: 'North Shore',
      inviteLink: 'https://example.com/invite/token',
      expiresAt: new Date('2026-09-11T00:00:00.000Z'),
    });
    assert.deepEqual(result, { sent: false, reason: 'not_configured' });
  } finally {
    if (previousHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = previousHost;
  }
});