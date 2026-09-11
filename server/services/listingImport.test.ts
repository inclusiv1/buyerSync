import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeListingUrl,
  listingCompleteness,
  normalizeProviderPayload,
  runProviderChain,
  type ListingImportProvider,
} from './listingImport.ts';

test('canonicalizes approved URLs and removes tracking parameters', () => {
  assert.equal(
    canonicalizeListingUrl('https://www.zillow.com/homedetails/123-Main-St/99_zpid/?utm_source=email&foo=bar#photos'),
    'https://www.zillow.com/homedetails/123-Main-St/99_zpid/?foo=bar',
  );
  assert.throws(() => canonicalizeListingUrl('http://www.zillow.com/home/1'), /HTTPS/);
  assert.throws(() => canonicalizeListingUrl('https://localhost/home/1'), /approved/);
  assert.throws(() => canonicalizeListingUrl('https://user:pass@www.redfin.com/home/1'), /credentials/);
});

test('normalizes PropertyWebScraper and HomeHarvest field variants', () => {
  const property = normalizeProviderPayload({
    data: [{
      street_address: '123 Main St',
      city: 'Austin',
      state_code: 'TX',
      postal_code: '78704',
      list_price: '$625,000',
      bedrooms: 4,
      bathrooms: 3,
      living_area: '2,140',
      image_urls: ['https://images.example/home.jpg'],
      lat: 30.25,
      lon: -97.75,
    }],
  });

  assert.equal(property.address, '123 Main St');
  assert.equal(property.price, 625000);
  assert.equal(property.sqft, 2140);
  assert.equal(property.latitude, 30.25);
  assert.equal(property.longitude, -97.75);
  assert.equal(listingCompleteness(property), 95);
});

test('normalizes current HomeHarvest search fields', () => {
  const property = normalizeProviderPayload({
    full_street_line: '3601 Longfellow Trl',
    city: 'Marietta',
    state: 'GA',
    zip_code: '30062',
    list_price: 300000,
    beds: 3,
    full_baths: 2,
    half_baths: 1,
    primary_photo: 'https://ap.rdcpix.com/example.jpg',
    property_url: 'https://www.realtor.com/realestateandhomes-detail/example',
  });

  assert.equal(property.address, '3601 Longfellow Trl');
  assert.equal(property.zip, '30062');
  assert.equal(property.baths, 2.5);
  assert.deepEqual(property.photos, ['https://ap.rdcpix.com/example.jpg']);
  assert.equal(property.sourceUrl, 'https://www.realtor.com/realestateandhomes-detail/example');
});

test('drops non-finite numeric values returned by import providers', async () => {
  const result = await runProviderChain('https://www.realtor.com/realestateandhomes-detail/example', [{
    name: 'non-finite-provider',
    enabled: () => true,
    extract: async () => ({ address: '123 Main St', price: 500000, lotSize: Number.NaN }),
  }]);

  assert.equal(result.lotSize, undefined);
  assert.equal(result.price, 500000);
});

test('uses providers in order and preserves higher-priority values', async () => {
  const calls: string[] = [];
  const provider = (name: string, data: Record<string, unknown>, enabled = true): ListingImportProvider => ({
    name,
    enabled: () => enabled,
    extract: async () => {
      calls.push(name);
      return data;
    },
  });

  const result = await runProviderChain('https://www.realtor.com/realestateandhomes-detail/123-Main-St_Austin_TX_78704', [
    provider('property-web-scraper', { price: 600000, beds: 4 }),
    provider('playwright-rendered-html', {}, false),
    provider('homeharvest', { price: 625000, baths: 3, sqft: 2140, photos: ['https://images.example/home.jpg'] }),
  ]);

  assert.deepEqual(calls, ['property-web-scraper', 'homeharvest']);
  assert.equal(result.price, 600000);
  assert.equal(result.baths, 3);
  assert.equal(result.address, '123 Main St');
  assert.deepEqual(result.attempts.map(({ status }) => status), ['incomplete', 'skipped', 'success']);
});