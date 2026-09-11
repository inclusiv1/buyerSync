import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRentCastSearchUrl, searchRentCastListings } from './listingSearch';

test('builds RentCast city, state, and ZIP searches with the maximum page size', () => {
  const city = buildRentCastSearchUrl({ location: 'Marietta, GA', limit: 50 }, 'https://api.rentcast.io/v1/listings/sale');
  assert.equal(city.searchParams.get('city'), 'Marietta');
  assert.equal(city.searchParams.get('state'), 'GA');
  assert.equal(city.searchParams.get('limit'), '500');

  const cityWithoutComma = buildRentCastSearchUrl({ location: 'Smyrna GA', limit: 50 }, 'https://api.rentcast.io/v1/listings/sale');
  assert.equal(cityWithoutComma.searchParams.get('city'), 'Smyrna');
  assert.equal(cityWithoutComma.searchParams.get('state'), 'GA');
  assert.equal(cityWithoutComma.searchParams.has('address'), false);

  const zip = buildRentCastSearchUrl({ location: '30339', limit: 50 }, 'https://api.rentcast.io/v1/listings/sale');
  assert.equal(zip.searchParams.get('zipCode'), '30339');
});

test('normalizes, filters, deduplicates, and bounds RentCast listings', async () => {
  const previousApiKey = process.env.RENTCAST_API_KEY;
  process.env.RENTCAST_API_KEY = 'test-key';
  const response = {
    ok: true,
    json: async () => [
      { id: 'one', formattedAddress: '1 Main St, Marietta, GA 30060', city: 'Marietta', state: 'GA', zipCode: '30060', price: 450_000, bedrooms: 3, bathrooms: 2, squareFootage: 1_900, propertyType: 'Single Family' },
      { id: 'one', formattedAddress: '1 Main St, Marietta, GA 30060', city: 'Marietta', state: 'GA', zipCode: '30060', price: 450_000, bedrooms: 3, bathrooms: 2, squareFootage: 1_900, propertyType: 'Single Family' },
      { id: 'two', formattedAddress: '2 Main St, Marietta, GA 30060', price: 800_000, bedrooms: 4, bathrooms: 3, propertyType: 'Single Family' },
      { id: 'three', formattedAddress: '3 Main St, Marietta, GA 30060', price: 400_000, bedrooms: 2, bathrooms: 2, propertyType: 'Condo' },
    ],
  } as Response;

  try {
    const listings = await searchRentCastListings({
      location: 'Marietta, GA',
      limit: 10,
      minPrice: 300_000,
      maxPrice: 500_000,
      minBeds: 3,
      minBaths: 2,
      propertyType: 'single_family',
    }, async () => response);

    assert.equal(listings.length, 1);
    assert.deepEqual({
      address: listings[0].address,
      city: listings[0].city,
      state: listings[0].state,
      zip: listings[0].zip,
      price: listings[0].price,
      beds: listings[0].beds,
      baths: listings[0].baths,
      sqft: listings[0].sqft,
      propertyType: listings[0].propertyType,
      mlsId: listings[0].mlsId,
    }, {
      address: '1 Main St, Marietta, GA 30060',
      city: 'Marietta',
      state: 'GA',
      zip: '30060',
      price: 450_000,
      beds: 3,
      baths: 2,
      sqft: 1_900,
      propertyType: 'Single Family',
      mlsId: 'one',
    });
  } finally {
    if (previousApiKey === undefined) delete process.env.RENTCAST_API_KEY;
    else process.env.RENTCAST_API_KEY = previousApiKey;
  }
});

test('matches natural-language property type variants returned by the copilot', async () => {
  const previousApiKey = process.env.RENTCAST_API_KEY;
  process.env.RENTCAST_API_KEY = 'test-key';
  const response = {
    ok: true,
    json: async () => [
      { id: 'one', formattedAddress: '1 Main St, Smyrna, GA 30080', city: 'Smyrna', state: 'GA', bedrooms: 3, bathrooms: 2, propertyType: 'Single Family' },
    ],
  } as Response;

  try {
    const listings = await searchRentCastListings({
      location: 'Smyrna, GA',
      limit: 50,
      minBeds: 3,
      minBaths: 2,
      propertyType: 'single-family homes',
    }, async () => response);

    assert.equal(listings.length, 1);
  } finally {
    if (previousApiKey === undefined) delete process.env.RENTCAST_API_KEY;
    else process.env.RENTCAST_API_KEY = previousApiKey;
  }
});