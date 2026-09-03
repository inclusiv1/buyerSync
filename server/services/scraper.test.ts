import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';
import { parsePropertyText, scrapeProperty } from './scraper.ts';

function zillowHtml(property: Record<string, unknown>): string {
  const cache = JSON.stringify({
    'ForSalePriorityQuery{"zpid":123}': { property },
  });
  const nextData = JSON.stringify({
    props: { pageProps: { componentProps: { gdpClientCache: cache } } },
  });
  return `<html><body><script id="__NEXT_DATA__">${nextData}</script></body></html>`;
}

test('extracts additional listing details from labeled pasted text', () => {
  const property = parsePropertyText(`
    Lot Size: 7,405 Sq. Ft.
    Association Fee: $180/month
    Property Sub Type: Residential
    Listing URL: www.example.com/listings/12345
  `);

  assert.equal(property.lotSize, 0.17);
  assert.equal(property.hoa, 180);
  assert.equal(property.propertyType, 'Residential');
  assert.equal(property.sourceUrl, 'https://www.example.com/listings/12345');
});

test('extracts complete listing details from multiline Zillow text', () => {
  const property = parsePropertyText(`
    $730,000
    89 High Meadows Ct, Morganton, GA 30560
    3
    beds

    3
    baths
    2,034
    sqft
    Est.: $4,285/mo
    Residential
    Built in 2021
    1.73 Acres Lot
    $359/sqft
    $31/mo HOA
    What's special
    Experience laidback luxury in this quintessential two-story creekside cabin, perfectly blending rustic warmth with refined, contemporary style. Nestled in a quiet gated community just minutes from Downtown Blue Ridge, Lake Blue Ridge, and Lake Nottely. The open-concept living area showcases soaring cathedral ceilings and a grand stacked-stone fireplace.

    Show more
    127 days on Zillow
    Facts & features
    Interior
    Bedrooms: 3
    Bathrooms: 3
    Total interior livable area: 2,034 sqft
    Property subtype: Residential
    Year built: 2021
    Lot
    Size: 1.73 Acres
    HOA
    Has HOA: Yes
    HOA fee: $375 annually
    Source: NGBOR,MLS#: 430060
  `);

  assert.equal(property.price, 730000);
  assert.equal(property.address, '89 High Meadows Ct');
  assert.equal(property.city, 'Morganton');
  assert.equal(property.state, 'GA');
  assert.equal(property.zip, '30560');
  assert.equal(property.beds, 3);
  assert.equal(property.baths, 3);
  assert.equal(property.sqft, 2034);
  assert.equal(property.yearBuilt, 2021);
  assert.equal(property.lotSize, 1.73);
  assert.equal(property.hoa, 31);
  assert.equal(property.propertyType, 'Residential');
  assert.equal(property.mlsId, '430060');
  assert.match(property.description || '', /^Experience laidback luxury/);
  assert.match(property.description || '', /stacked-stone fireplace\.$/);
});

test('uses the reader fallback when a listing site blocks the direct request', async (t) => {
  const listingUrl = 'https://www.zillow.com/homedetails/123-Main-St-Austin-TX-78704/12345678_zpid/';

  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Native request blocked');
  });
  t.mock.method(axios, 'get', async (requestedUrl: string) => {
    if (requestedUrl === listingUrl) {
      throw new Error('Request failed with status code 403');
    }

    assert.equal(requestedUrl, `https://r.jina.ai/${listingUrl}`);
    return {
      data: `
        123 Main St, Austin, TX 78704
        Price: $450,000
        3 beds | 2.5 baths | 1,850 sqft
        Built in 1998
      `
    };
  });

  const property = await scrapeProperty(listingUrl);

  assert.equal(property.address, '123 Main St');
  assert.equal(property.price, 450000);
  assert.equal(property.beds, 3);
  assert.equal(property.baths, 2.5);
  assert.equal(property.sqft, 1850);
  assert.equal(property.yearBuilt, 1998);
});

test('retries the reader when its first response contains no listing details', async (t) => {
  const listingUrl = 'https://www.realtor.com/realestateandhomes-detail/123-Main-St_Austin_TX_78704';
  let readerRequests = 0;

  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Native request blocked');
  });
  t.mock.method(axios, 'get', async (requestedUrl: string) => {
    if (requestedUrl === listingUrl) {
      throw new Error('Request failed with status code 403');
    }

    assert.equal(requestedUrl, `https://r.jina.ai/${listingUrl}`);
    readerRequests += 1;
    if (readerRequests === 1) {
      return { data: 'Access denied. Please verify you are human.' };
    }

    return {
      data: {
        data: {
          content: `
            $625,000
            4 beds | 3 baths | 2,140 sqft
            Year built: 2006
          `
        }
      }
    };
  });

  const property = await scrapeProperty(listingUrl);

  assert.equal(readerRequests, 2);
  assert.equal(property.price, 625000);
  assert.equal(property.beds, 4);
  assert.equal(property.baths, 3);
  assert.equal(property.sqft, 2140);
  assert.equal(property.yearBuilt, 2006);
});

test('normalizes a Zillow property id and retries with the native client', async (t) => {
  const listingUrl = 'https://www.zillow.com/homedetails/941-Hidden-Valley-Dr-Morganton-GA-30560/96827743';
  const canonicalUrl = 'https://www.zillow.com/homedetails/941-Hidden-Valley-Dr-Morganton-GA-30560/96827743_zpid/';

  t.mock.method(axios, 'get', async (requestedUrl: string) => {
    assert.equal(requestedUrl, canonicalUrl);
    throw new Error('Axios request blocked');
  });
  t.mock.method(globalThis, 'fetch', async (requestedUrl) => {
    assert.equal(String(requestedUrl), canonicalUrl);
    return new Response(zillowHtml({
      address: { streetAddress: '941 Hidden Valley Dr', city: 'Morganton', state: 'GA', zipcode: '30560' },
      price: 439610,
      bedrooms: 2,
      bathrooms: 1,
      livingArea: 1168,
    }));
  });

  const property = await scrapeProperty(listingUrl);

  assert.equal(property.price, 439610);
  assert.equal(property.beds, 2);
  assert.equal(property.baths, 1);
  assert.equal(property.sqft, 1168);
  assert.equal(property.sourceUrl, listingUrl);
});

test('resolves a blocked Realtor listing through Zillow address search', async (t) => {
  const listingUrl = 'https://www.realtor.com/realestateandhomes-detail/95-Scenic-Way_Ellijay_GA_30540_M55921-79615';
  const zillowSearchUrl = 'https://www.zillow.com/homes/95-Scenic-Way-Ellijay-GA-30540_rb/';

  t.mock.method(axios, 'get', async (requestedUrl: string) => {
    assert.equal(requestedUrl, listingUrl);
    throw new Error('Realtor request rate limited');
  });
  t.mock.method(globalThis, 'fetch', async (requestedUrl) => {
    if (String(requestedUrl) === listingUrl) {
      return new Response('Too many requests', { status: 429 });
    }

    assert.equal(String(requestedUrl), zillowSearchUrl);
    return new Response(zillowHtml({
      address: { streetAddress: '95 Scenic Way', city: 'Ellijay', state: 'GA', zipcode: '30540' },
      price: 675000,
      bedrooms: 2,
      bathrooms: 3,
      livingAreaValue: 1576,
      yearBuilt: 2004,
    }));
  });

  const property = await scrapeProperty(listingUrl);

  assert.equal(property.price, 675000);
  assert.equal(property.beds, 2);
  assert.equal(property.baths, 3);
  assert.equal(property.sqft, 1576);
  assert.equal(property.yearBuilt, 2004);
  assert.equal(property.mlsId, 'M55921-79615');
  assert.equal(property.sourceUrl, listingUrl);
});