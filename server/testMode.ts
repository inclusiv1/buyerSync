import bcrypt from 'bcryptjs';
import prisma from './lib/prisma';

export const testAccounts = [
  { name: 'Alex Morgan', email: 'alex@test.buyersync.local', role: 'primary_buyer', profileSlug: 'test-alex-morgan' },
  { name: 'Blair Chen', email: 'blair@test.buyersync.local', role: 'co_buyer', profileSlug: 'test-blair-chen' },
  { name: 'Cameron Rivera', email: 'cameron@test.buyersync.local', role: 'co_buyer', profileSlug: 'test-cameron-rivera' },
] as const;

const testPassword = 'TestHome123!';
const testSearchName = 'Test Collaborative Search';

export const isTestMode = () => {
  const runtimeEnvironment = process.env.NODE_ENV ?? 'development';
  return process.env.APP_MODE === 'test' && ['development', 'test'].includes(runtimeEnvironment);
};

export const setupTestMode = async () => {
  if (!isTestMode()) {
    throw new Error('Test data requires APP_MODE=test with NODE_ENV=development or test');
  }

  const passwordHash = await bcrypt.hash(testPassword, 10);
  const users = await Promise.all(testAccounts.map(account => prisma.user.upsert({
    where: { email: account.email },
    update: { name: account.name, passwordHash, role: account.role, profileSlug: account.profileSlug },
    create: { ...account, passwordHash },
  })));

  const primaryBuyer = users[0];
  const group = await prisma.buyerGroup.upsert({
    where: { primaryBuyerId_name: { primaryBuyerId: primaryBuyer.id, name: testSearchName } },
    update: {},
    create: { name: testSearchName, primaryBuyerId: primaryBuyer.id },
  });

  await Promise.all(users.map((user, index) => prisma.groupMembership.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    update: { role: index === 0 ? 'buyer' : 'co_buyer', status: 'accepted' },
    create: { groupId: group.id, userId: user.id, role: index === 0 ? 'buyer' : 'co_buyer', status: 'accepted' },
  })));
  await prisma.searchCriteria.upsert({
    where: { groupId: group.id },
    update: {},
    create: { groupId: group.id },
  });

  return { users, group };
};