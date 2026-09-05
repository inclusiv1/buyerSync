import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInvitationMessage, sendInvitationEmail } from './email';

test('builds an invitation email with the project and acceptance link', () => {
  const message = buildInvitationMessage({
    inviterName: 'Alex Morgan',
    searchName: 'North Shore',
    inviteLink: 'https://example.com/invite/token',
    expiresAt: new Date('2026-09-11T00:00:00.000Z'),
  });

  assert.match(message.subject, /North Shore/);
  assert.match(message.text, /https:\/\/example\.com\/invite\/token/);
  assert.match(message.html, /Accept invitation/);
  assert.match(message.html, /September 11, 2026/);
});

test('escapes user-controlled values in invitation HTML', () => {
  const message = buildInvitationMessage({
    inviterName: '<script>alert(1)</script>',
    searchName: 'Homes & Condos',
    inviteLink: 'https://example.com/invite/token?a=1&b=2',
    expiresAt: new Date('2026-09-11T00:00:00.000Z'),
  });

  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /Homes &amp; Condos/);
  assert.match(message.html, /a=1&amp;b=2/);
});

test('reports that delivery is unavailable when SMTP is not configured', async () => {
  const previousHost = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;

  try {
    const result = await sendInvitationEmail({
      to: 'friend@example.com',
      inviterName: 'Alex Morgan',
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