import assert from 'node:assert/strict';
import test from 'node:test';
import { isCampaignLive, parseCampaign, safeHttpsUrl } from './advertising';

test('campaign input accepts safe creative data and a valid schedule', () => {
  const campaign = parseCampaign({
    name: 'Local lender', headline: 'Know your buying power', body: 'Get a personalized estimate.',
    imageUrl: 'https://example.com/home.jpg', destinationUrl: 'https://example.com/offer',
    placement: 'left', startsAt: '2026-09-01', endsAt: '2026-10-01',
  });
  assert.equal(campaign.placement, 'left');
  assert.equal(campaign.destinationUrl, 'https://example.com/offer');
});

test('campaign input rejects unsafe URLs and reversed schedules', () => {
  assert.throws(() => safeHttpsUrl('javascript:alert(1)', 'Destination URL'), /HTTPS/);
  assert.throws(() => parseCampaign({
    name: 'Campaign', headline: 'Headline', body: 'Copy', imageUrl: 'https://example.com/a.jpg',
    destinationUrl: 'https://example.com', startsAt: '2026-10-01', endsAt: '2026-09-01',
  }), /after start/);
});

test('campaign input accepts only trusted local creative paths', () => {
  const campaign = parseCampaign({
    name: 'Campaign', headline: 'Headline', body: 'Copy',
    imageUrl: '/api/uploads/ad-creatives/5bf8b3c1-69c1-4f25-84a7-09a19a1f7f95.webp',
    destinationUrl: 'https://example.com',
  });
  assert.match(campaign.imageUrl, /^\/api\/uploads\/ad-creatives\//);
  assert.throws(() => parseCampaign({
    name: 'Campaign', headline: 'Headline', body: 'Copy', imageUrl: '/uploads/untrusted.jpg',
    destinationUrl: 'https://example.com',
  }), /valid URL/);
});

test('only approved, paid, currently scheduled campaigns are live', () => {
  const now = new Date('2026-09-03T12:00:00Z');
  assert.equal(isCampaignLive({ status: 'approved', paymentStatus: 'paid', startsAt: null, endsAt: null }, now), true);
  assert.equal(isCampaignLive({ status: 'pending', paymentStatus: 'paid', startsAt: null, endsAt: null }, now), false);
  assert.equal(isCampaignLive({ status: 'approved', paymentStatus: 'paid', startsAt: null, endsAt: new Date('2026-09-01') }, now), false);
});