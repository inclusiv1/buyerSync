import type { PrismaClient } from '@prisma/client';
import { getSearchProfile, listChecklistRequirements, rankSavedProperties } from './domain';

export interface Retriever {
  retrieve(userId: string, groupId: string): Promise<unknown>;
}

export class PrismaRetriever implements Retriever {
  constructor(private readonly db: PrismaClient) {}

  async retrieve(userId: string, groupId: string) {
    const [profile, checklist, ranked] = await Promise.all([
      getSearchProfile(this.db, userId, groupId),
      listChecklistRequirements(this.db, userId, groupId),
      rankSavedProperties(this.db, userId, groupId),
    ]);
    return {
      criteria: profile.criteria,
      checklist: checklist.items.slice(0, 100),
      properties: ranked.properties.slice(0, 50),
    };
  }
}