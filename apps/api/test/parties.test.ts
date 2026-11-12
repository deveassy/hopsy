import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { Prisma } from '../src/generated/prisma/client.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const party = { id, ownerId, name: 'Hopsy', createdAt: new Date(), updatedAt: new Date() };

function setup() {
  const db = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: ownerId }) },
    party: {
      create: vi.fn().mockResolvedValue(party),
      findUnique: vi.fn().mockResolvedValue(party),
    },
  };
  return { db, app: buildApp({ db, logger: false }) };
}

describe('Party API', () => {
  let context: ReturnType<typeof setup>;
  beforeEach(() => { context = setup(); });
  afterEach(async () => { await context.app.close(); });

  it('creates a party for an existing user, trims the name, and returns 201', async () => {
    const response = await context.app.inject({ method: 'POST', url: '/parties', payload: { name: ' Hopsy ', ownerId } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ...party, createdAt: party.createdAt.toISOString(), updatedAt: party.updatedAt.toISOString() });
    expect(context.db.user.findUnique).toHaveBeenCalledWith({ where: { id: ownerId }, select: { id: true } });
    expect(context.db.party.create).toHaveBeenCalledWith({ data: { name: 'Hopsy', ownerId } });
  });

  it('retrieves a party with 200', async () => {
    const response = await context.app.inject(`/parties/${id}`);
    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(id);
    expect(context.db.party.findUnique).toHaveBeenCalledWith({ where: { id } });
  });

  it.each([
    {}, { name: 'Hopsy' }, { ownerId }, { name: '', ownerId },
    { name: '   ', ownerId }, { name: 'a'.repeat(101), ownerId },
    { name: 123, ownerId }, { name: 'Hopsy', ownerId: 'invalid' },
    { name: 'Hopsy', ownerId, extra: 'unexpected' },
    { name: ['Hopsy'], ownerId },
  ])('rejects invalid body %j before database access', async (payload) => {
    const response = await context.app.inject({ method: 'POST', url: '/parties', payload });
    expect(response.statusCode).toBe(400);
    expect(context.db.user.findUnique).not.toHaveBeenCalled();
    expect(context.db.party.create).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const response = await context.app.inject({ method: 'POST', url: '/parties', headers: { 'content-type': 'application/json' }, payload: '{' });
    expect(response.statusCode).toBe(400);
    expect(context.db.party.create).not.toHaveBeenCalled();
  });

  it('rejects invalid route parameters before database access', async () => {
    const response = await context.app.inject('/parties/not-a-uuid');
    expect(response.statusCode).toBe(400);
    expect(context.db.party.findUnique).not.toHaveBeenCalled();
  });

  it('returns 400 without creating a party when the owner does not exist', async () => {
    context.db.user.findUnique.mockResolvedValue(null);
    const response = await context.app.inject({ method: 'POST', url: '/parties', payload: { name: 'Hopsy', ownerId } });
    expect(response.statusCode).toBe(400);
    expect(context.db.party.create).not.toHaveBeenCalled();
  });

  it('handles an owner deleted before insertion without leaking the DB error', async () => {
    context.db.party.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('secret connection string', { code: 'P2003', clientVersion: '7.10.1' }));
    const response = await context.app.inject({ method: 'POST', url: '/parties', payload: { name: 'Hopsy', ownerId } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ message: 'Owner does not exist' });
  });

  it('returns 404 for an unknown party', async () => {
    context.db.party.findUnique.mockResolvedValue(null);
    const response = await context.app.inject(`/parties/${id}`);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: 'Party not found' });
  });

  it.each(['owner lookup', 'create', 'retrieve'])('returns a safe 500 for failed %s', async (operation) => {
    const error = new Error('postgresql://secret:password@database:5432 SQL SELECT');
    if (operation === 'owner lookup') context.db.user.findUnique.mockRejectedValue(error);
    if (operation === 'create') context.db.party.create.mockRejectedValue(error);
    if (operation === 'retrieve') context.db.party.findUnique.mockRejectedValue(error);
    const response = await context.app.inject(operation === 'retrieve'
      ? { method: 'GET', url: `/parties/${id}` }
      : { method: 'POST', url: '/parties', payload: { name: 'Hopsy', ownerId } });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ message: 'Internal server error' });
    expect(response.body).not.toContain('password');
  });

  it('keeps the health endpoint working', async () => {
    const response = await context.app.inject('/health');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
