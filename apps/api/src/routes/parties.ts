import type { FastifyPluginAsync } from 'fastify';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';

export type PartyDatabase = {
  user: Pick<PrismaClient['user'], 'findUnique'>;
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

export const partyRoutes: FastifyPluginAsync<{ db: PartyDatabase }> = async (app, { db }) => {
  app.post<{ Body: { name: string; ownerId: string } }>('/parties', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'ownerId'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100, pattern: '\\S' },
          ownerId: uuid,
        },
      },
      response: { 201: partyResponse },
    },
  }, async (request, reply) => {
    const { name, ownerId } = request.body;
    const owner = await db.user.findUnique({ where: { id: ownerId }, select: { id: true } });
    if (!owner) return reply.code(400).send({ message: 'Owner does not exist' });

    try {
      const party = await db.party.create({ data: { name: name.trim(), ownerId } });
      return reply.code(201).send(party);
    } catch (error) {
      // The owner may have been deleted between the lookup and insert.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        return reply.code(400).send({ message: 'Owner does not exist' });
      }
      throw error;
    }
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
