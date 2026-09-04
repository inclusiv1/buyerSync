import axios from 'axios';
import prisma from '../lib/prisma';

const rateSeries = [
  { id: 'MORTGAGE30US', type: '30yr' },
  { id: 'MORTGAGE15US', type: '15yr' },
] as const;
const refreshIntervalMs = 6 * 60 * 60 * 1000;
let lastRefreshAttempt = 0;

export async function fetchAndCacheRates() {
  try {
    lastRefreshAttempt = Date.now();
    await Promise.all(rateSeries.map(async ({ id, type }) => {
      const { data } = await axios.get<string>('https://fred.stlouisfed.org/graph/fredgraph.csv', {
        params: { id, cosd: '2000-01-01' },
        responseType: 'text',
        timeout: 10_000,
      });
      const latestLine = data.trim().split(/\r?\n/).reverse().find(line => /^\d{4}-\d{2}-\d{2},\d/.test(line));
      if (!latestLine) throw new Error(`No current observation returned for ${id}`);
      const [dateValue, rateValue] = latestLine.split(',');
      const date = new Date(`${dateValue}T00:00:00.000Z`);
      const rate = Number(rateValue);
      if (!Number.isFinite(rate)) throw new Error(`Invalid observation returned for ${id}`);

      const existing = await prisma.interestRateSnapshot.findFirst({ where: { date, rateType: type, source: 'Freddie Mac PMMS via FRED' } });
      if (!existing) {
        await prisma.interestRateSnapshot.create({
          data: {
            date,
            source: 'Freddie Mac PMMS via FRED',
            rateType: type,
            rate,
          }
        });
      }
    }));
  } catch (error) {
    console.error('Failed to fetch mortgage rates:', error);
  }
}

export async function getLatestRates() {
  if (!lastRefreshAttempt || Date.now() - lastRefreshAttempt >= refreshIntervalMs) {
    await fetchAndCacheRates();
  }

  const snapshots = await Promise.all(rateSeries.map(async ({ type }) => (
    await prisma.interestRateSnapshot.findFirst({
      where: { rateType: type, source: 'Freddie Mac PMMS via FRED' },
      orderBy: [{ date: 'desc' }, { fetchedAt: 'desc' }],
    }) || prisma.interestRateSnapshot.findFirst({
      where: { rateType: type },
      orderBy: [{ date: 'desc' }, { fetchedAt: 'desc' }],
    })
  )));

  return snapshots.filter(snapshot => snapshot !== null);
}
