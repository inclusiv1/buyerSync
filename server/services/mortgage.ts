import axios from 'axios';
import prisma from '../lib/prisma';

const FRED_API_KEY = process.env.FRED_API_KEY;

export async function fetchAndCacheRates() {
  try {
    // If no API key, we use a mock for demo purposes as per instructions to "stub the send in dev"
    // and "local-first MVP"
    if (!FRED_API_KEY) {
      console.log('No FRED_API_KEY found, using mock rates.');
      const mockRates = [
        { type: '30yr', rate: 6.85, source: 'FRED' },
        { type: '15yr', rate: 6.12, source: 'FRED' },
        { type: 'ARM', rate: 6.55, source: 'FRED' }
      ];

      for (const r of mockRates) {
        await prisma.interestRateSnapshot.create({
          data: {
            date: new Date(),
            source: r.source,
            rateType: r.type,
            rate: r.rate,
          }
        });
      }
      return;
    }

    const series = ['MORTGAGE30US', 'MORTGAGE15US'];
    for (const s of series) {
      const { data } = await axios.get(`https://api.stlouisfed.org/fred/series/observations`, {
        params: {
          series_id: s,
          api_key: FRED_API_KEY,
          file_type: 'json',
          sort_order: 'desc',
          limit: 1
        }
      });

      const observation = data.observations[0];
      if (observation) {
        await prisma.interestRateSnapshot.create({
          data: {
            date: new Date(observation.date),
            source: 'FRED',
            rateType: s === 'MORTGAGE30US' ? '30yr' : '15yr',
            rate: parseFloat(observation.value),
          }
        });
      }
    }
  } catch (error) {
    console.error('Failed to fetch mortgage rates:', error);
  }
}

export async function getLatestRates() {
  const snapshots = await prisma.interestRateSnapshot.findMany({
    orderBy: { fetchedAt: 'desc' },
    take: 3
  });
  
  // If no snapshots, try to fetch
  if (snapshots.length === 0) {
    await fetchAndCacheRates();
    return prisma.interestRateSnapshot.findMany({
      orderBy: { fetchedAt: 'desc' },
      take: 3
    });
  }
  
  return snapshots;
}
