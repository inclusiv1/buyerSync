import assert from 'node:assert/strict';
import test from 'node:test';
import { getInvitationBaseUrl } from './invitationUrl';

const request = (headers: Record<string, string> = {}, protocol = 'http') => ({
  protocol,
  get: (name: string) => headers[name.toLowerCase()],
});

test('uses the browser origin instead of a stale configured localhost URL', () => {
  const previousUrl = process.env.PUBLIC_APP_URL;
  process.env.PUBLIC_APP_URL = 'http://localhost:5173';
  try {
    assert.equal(
      getInvitationBaseUrl(request({ origin: 'https://buyersync.onrender.com' })),
      'https://buyersync.onrender.com',
    );
  } finally {
    if (previousUrl === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = previousUrl;
  }
});

test('uses Render-style forwarded headers when an origin is not present', () => {
  assert.equal(
    getInvitationBaseUrl(request({
      'x-forwarded-host': 'buyersync.onrender.com',
      'x-forwarded-proto': 'https',
    })),
    'https://buyersync.onrender.com',
  );
});

test('falls back to the configured public URL for non-browser requests', () => {
  const previousUrl = process.env.PUBLIC_APP_URL;
  process.env.PUBLIC_APP_URL = 'https://app.example.com/path';
  try {
    assert.equal(getInvitationBaseUrl(request()), 'https://app.example.com');
  } finally {
    if (previousUrl === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = previousUrl;
  }
});