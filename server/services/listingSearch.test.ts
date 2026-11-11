import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRentCastSearchUrl, searchPublicListings, searchRentCastListings } from './listingSearch';

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

test('applies available Zillow-style numeric, keyword, listing, and home feature filters', async () => {
  const previousApiKey = process.env.RENTCAST_API_KEY;
  process.env.RENTCAST_API_KEY = 'test-key';
  const response = {
    ok: true,
    json: async () => [
      {
        id: 'match',
        formattedAddress: '1 Main St, Austin, TX 78704',
        bedrooms: 3,
        squareFootage: 1_800,
        days_on_market: 12,
        propertyType: 'Single Family',
        listing_types: ['by_owner'],
        features: ['Swimming Pool', 'Lakefront'],
        description: 'Recently updated kitchen and outdoor living area',
      },
      {
        id: 'too-large',
        formattedAddress: '2 Main St, Austin, TX 78704',
        bedrooms: 5,
        squareFootage: 2_400,
        days_on_market: 12,
        propertyType: 'Single Family',
        listing_types: ['By Owner'],
        features: ['Pool', 'Waterfront'],
        description: 'Recently updated kitchen',
      },
      {
        id: 'wrong-subtype',
        formattedAddress: '3 Main St, Austin, TX 78704',
        bedrooms: 3,
        squareFootage: 1_800,
        days_on_market: 12,
        propertyType: 'Single Family',
        listing_types: ['By Agent'],
        features: ['Pool', 'Waterfront'],
        description: 'Recently updated kitchen',
      },
    ],
  } as Response;

  try {
    const listings = await searchRentCastListings({
      location: 'Austin, TX',
      limit: 10,
      maxBeds: 4,
      maxSqft: 2_000,
      daysOld: 30,
      propertyTypes: ['Single Family'],
      listingTypes: ['By Owner'],
      homeFeatures: ['Pool', 'Waterfront'],
      keywords: 'updated kitchen',
    }, async () => response);

    assert.deepEqual(listings.map((listing) => listing.address), ['1 Main St, Austin, TX 78704']);
  } finally {
    if (previousApiKey === undefined) delete process.env.RENTCAST_API_KEY;
    else process.env.RENTCAST_API_KEY = previousApiKey;
  }
});

test('forwards supported extended filters to the HomeHarvest adapter', async () => {
  const previousRentCastApiKey = process.env.RENTCAST_API_KEY;
  const previousHomeHarvestUrl = process.env.HOMEHARVEST_SERVICE_URL;
  delete process.env.RENTCAST_API_KEY;
  process.env.HOMEHARVEST_SERVICE_URL = 'http://homeharvest.test';
  let requestBody: Record<string, unknown> | undefined;

  try {
    await searchPublicListings({
      location: 'HomeHarvest filter pass-through test',
      limit: 10,
      maxBeds: 4,
      minSqft: 1_200,
      maxSqft: 2_400,
      lotSizeMin: 5_000,
      lotSizeMax: 12_000,
      yearBuiltMin: 1990,
      yearBuiltMax: 2020,
      daysOld: 30,
      propertyTypes: ['Single Family'],
      listingTypes: ['Foreclosures'],
    }, async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return { ok: true, json: async () => ({ listings: [] }) } as Response;
    });

    assert.deepEqual(requestBody, {
      location: 'HomeHarvest filter pass-through test',
      listing_type: 'for_sale',
      limit: 10,
      max_beds: 4,
      min_sqft: 1_200,
      max_sqft: 2_400,
      lot_size_min: 5_000,
      lot_size_max: 12_000,
      year_built_min: 1990,
      year_built_max: 2020,
      days_old: 30,
      foreclosure: true,
      property_type: 'single_family',
    });
  } finally {
    if (previousRentCastApiKey === undefined) delete process.env.RENTCAST_API_KEY;
    else process.env.RENTCAST_API_KEY = previousRentCastApiKey;
    if (previousHomeHarvestUrl === undefined) delete process.env.HOMEHARVEST_SERVICE_URL;
    else process.env.HOMEHARVEST_SERVICE_URL = previousHomeHarvestUrl;
  }
});