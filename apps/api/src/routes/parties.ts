import type { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { VerifyToken } from '../lib/supabase-auth.js';

declare module 'fastify' {
  interface FastifyRequest { authUserId: string }
}

export type PartyDatabase = {
  user: Pick<PrismaClient['user'], 'upsert'>;
  party: Pick<PrismaClient['party'], 'create' | 'findUnique'>;
};

const uuid = { type: 'string', format: 'uuid' } as const;
const partyResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'ownerId', 'createdAt', 'updatedAt'],
  properties: {
    id: uuid,
    name: { type: 'string' },
    ownerId: uuid,
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

export const partyRoutes: FastifyPluginAsync<{ db: PartyDatabase; verifyToken: VerifyToken }> = async (app, { db, verifyToken }) => {
  app.decorateRequest('authUserId', '');
  app.addHook('onRequest', async (request, reply) => {
    const match = /^Bearer ([^\s]+)$/i.exec(request.headers.authorization ?? '');
    const user = match ? await verifyToken(match[1]!) : null;
    if (!user) {
      return reply.header('WWW-Authenticate', 'Bearer').code(401).send({ message: 'Unauthorized' });
    }
    request.authUserId = user.id;
  });
  app.addHook('preHandler', async (request) => {
    await db.user.upsert({
      where: { id: request.authUserId },
      create: { id: request.authUserId, name: 'Anonymous' },
      update: {},
    });
  });

  app.post<{ Body: { name: string } }>('/parties', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
        },
      },
      response: { 201: partyResponse },
    },
  }, async (request, reply) => {
    const party = await db.party.create({ data: { name: request.body.name.trim(), ownerId: request.authUserId } });
    return reply.code(201).send(party);
  });

  app.get<{ Params: { id: string } }>('/parties/:id', {
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: uuid } },
      response: { 200: partyResponse },
    },
  }, async (request, reply) => {
    const party = await db.party.findUnique({ where: { id: request.params.id } });
    if (!party) return reply.code(404).send({ message: 'Party not found' });
    return party;
  });
};
