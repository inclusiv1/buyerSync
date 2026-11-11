import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  getLinqConfig,
  sendLinqMessage,
  sendListingAlertMessage,
  sendDecisionAlertMessage,
  parseLinqWebhookEvent,
  verifyLinqWebhookSignature,
  processInboundLinqMessage,
  type LinqEffect,
} from '../services/linq';
import { getLinqListenerStatus } from '../services/linqListener';
import { resolveAcceptedMembership } from '../services/assistant/domain';
import type { AssistantProvider } from '../services/assistant/types';

type AuthenticatedRequest = Request & { userId?: string };

const linqEffects: LinqEffect[] = [
  'confetti', 'fireworks', 'lasers', 'sparkles', 'celebration', 'hearts',
  'love', 'balloons', 'happy_birthday', 'echo', 'spotlight', 'slam', 'loud', 'gentle', 'invisible',
];

const sendMessageSchema = z.object({
  to: z.string().trim().min(7).max(30),
  message: z.string().trim().min(1).max(2000),
  effect: z.enum(linqEffects as [LinqEffect, ...LinqEffect[]]).optional(),
  attachmentUrl: z.string().url().max(2048).optional(),
}).strict();

const sendListingAlertSchema = z.object({
  to: z.string().trim().min(7).max(30),
  propertyId: z.string().trim().min(1).max(200),
  groupId: z.string().trim().min(1).max(200).optional(),
  customNote: z.string().trim().max(500).optional(),
  effect: z.enum(linqEffects as [LinqEffect, ...LinqEffect[]]).optional(),
}).strict();

const sendDecisionAlertSchema = z.object({
  to: z.string().trim().min(7).max(30),
  propertyId: z.string().trim().min(1).max(200),
  groupId: z.string().trim().min(1).max(200).optional(),
  effect: z.enum(linqEffects as [LinqEffect, ...LinqEffect[]]).optional(),
}).strict();

export function createLinqRouter(db: PrismaClient, options?: { provider?: AssistantProvider | null }) {
  const router = Router();

  /**
   * Status Endpoint: Check Linq configuration and health.
   */
  router.get('/status', (_req, res) => {
    const config = getLinqConfig();
    const listener = getLinqListenerStatus();
    res.json({
      configured: config.isConfigured,
      phoneNumber: config.phoneNumber,
      apiBaseUrl: config.apiBaseUrl,
      hasWebhookSecret: Boolean(config.webhookSecret),
      listener,
    });
  });

  /**
   * Webhook Handler: Ingests real-time events from Linq (message.received, etc.).
   */
  const handleWebhook = async (req: Request, res: Response) => {
    const signature = (req.headers['x-linq-signature'] || req.headers['x-webhook-signature']) as string | undefined;
    const timestamp = (req.headers['x-linq-timestamp'] || req.headers['x-webhook-timestamp']) as string | undefined;
    const rawPayload = JSON.stringify(req.body);

    const isValid = verifyLinqWebhookSignature({
      payload: rawPayload,
      signature,
      timestamp,
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    try {
      const event = parseLinqWebhookEvent(req.body);

      // Handle inbound message if type matches
      if (event.type === 'message.received' || !event.type.includes('.')) {
        const result = await processInboundLinqMessage(event, db, { provider: options?.provider });
        return res.json({
          status: 'ok',
          received: true,
          handled: result.handled,
          replySent: result.replySent,
        });
      }

      res.json({ status: 'ok', received: true, eventType: event.type });
    } catch (error) {
      console.error('Error processing Linq webhook event:', error);
      res.status(500).json({ error: 'Failed to process webhook event' });
    }
  };

  router.post('/webhook', handleWebhook);
  router.post('/', handleWebhook);

  /**
   * Send Direct Message Endpoint (Authenticated).
   */
  router.post('/send', async (rawReq, res) => {
    const req = rawReq as AuthenticatedRequest;
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const input = sendMessageSchema.parse(req.body);
      const result = await sendLinqMessage({
        to: input.to,
        message: input.message,
        effect: input.effect,
        attachmentUrl: input.attachmentUrl,
      });

      if (!result.success) {
        return res.status(result.reason === 'not_configured' ? 503 : 400).json(result);
      }

      res.json(result);
    } catch (error) {
      const message = error instanceof z.ZodError ? 'Invalid message payload' : error instanceof Error ? error.message : 'Send failed';
      res.status(400).json({ error: message });
    }
  });

  /**
   * Send Listing Alert Endpoint (Authenticated).
   */
  router.post('/alert-listing', async (rawReq, res) => {
    const req = rawReq as AuthenticatedRequest;
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const input = sendListingAlertSchema.parse(req.body);
      const membership = await resolveAcceptedMembership(db, req.userId, input.groupId);

      const property = await db.property.findFirst({
        where: {
          id: input.propertyId,
          groupId: membership.groupId,
        },
        include: { group: true },
      });

      if (!property) {
        return res.status(404).json({ error: 'Property not found in authorized group' });
      }

      let parsedPhotos: string[] = [];
      try {
        parsedPhotos = JSON.parse(property.photos);
      } catch {
        parsedPhotos = [];
      }

      const result = await sendListingAlertMessage({
        to: input.to,
        property: {
          address: property.address,
          city: property.city,
          state: property.state,
          zip: property.zip,
          price: property.price,
          beds: property.beds,
          baths: property.baths,
          sqft: property.sqft,
          photos: parsedPhotos,
          url: property.sourceUrl,
        },
        groupName: property.group?.name,
        customNote: input.customNote,
        effect: input.effect || 'sparkles',
      });

      if (!result.success) {
        return res.status(result.reason === 'not_configured' ? 503 : 400).json(result);
      }

      res.json(result);
    } catch (error) {
      const message = error instanceof z.ZodError ? 'Invalid alert payload' : error instanceof Error ? error.message : 'Alert failed';
      res.status(400).json({ error: message });
    }
  });

  /**
   * Send Collaborative Decision Alert Endpoint (Authenticated).
   */
  router.post('/alert-decision', async (rawReq, res) => {
    const req = rawReq as AuthenticatedRequest;
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const input = sendDecisionAlertSchema.parse(req.body);
      const membership = await resolveAcceptedMembership(db, req.userId, input.groupId);

      const property = await db.property.findFirst({
        where: {
          id: input.propertyId,
          groupId: membership.groupId,
        },
        include: { group: true },
      });

      if (!property) {
        return res.status(404).json({ error: 'Property not found in authorized group' });
      }

      const result = await sendDecisionAlertMessage({
        to: input.to,
        propertyAddress: property.address,
        score: property.compositeScore,
        status: property.status,
        groupName: property.group?.name,
        effect: input.effect || 'celebration',
      });

      if (!result.success) {
        return res.status(result.reason === 'not_configured' ? 503 : 400).json(result);
      }

      res.json(result);
    } catch (error) {
      const message = error instanceof z.ZodError ? 'Invalid alert payload' : error instanceof Error ? error.message : 'Alert failed';
      res.status(400).json({ error: message });
    }
  });

  return router;
}
