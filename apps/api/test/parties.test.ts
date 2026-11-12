import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';

const ownerId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const party = { id, ownerId, name: 'Hopsy', createdAt: new Date(), updatedAt: new Date() };

function setup() {
  const db = {
    user: { upsert: vi.fn().mockResolvedValue({ id: ownerId }) },
    party: {
      create: vi.fn().mockResolvedValue(party),
      findUnique: vi.fn().mockResolvedValue(party),
    },
  };
  const verifyToken = vi.fn().mockResolvedValue({ id: ownerId });
  return { db, verifyToken, app: buildApp({ db, verifyToken, logger: false }) };
}

describe('Party API', () => {
  let context: ReturnType<typeof setup>;
  beforeEach(() => { context = setup(); });
  afterEach(async () => { await context.app.close(); });

  it('creates a party for an existing user, trims the name, and returns 201', async () => {
    const response = await context.app.inject({ method: 'POST', headers: { authorization: 'Bearer verified-token' }, url: '/parties', payload: { name: ' Hopsy ' } });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ...party, createdAt: party.createdAt.toISOString(), updatedAt: party.updatedAt.toISOString() });
    expect(context.db.user.upsert).toHaveBeenCalledWith({ where: { id: ownerId }, create: { id: ownerId, name: 'Anonymous' }, update: {} });
    expect(context.db.party.create).toHaveBeenCalledWith({ data: { name: 'Hopsy', ownerId } });
  });

  it('retrieves a party with 200', async () => {
    const response = await context.app.inject({ url: `/parties/${id}`, headers: { authorization: 'Bearer verified-token' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(id);
    expect(context.db.party.findUnique).toHaveBeenCalledWith({ where: { id } });
  });

  it.each([
    {}, { ownerId }, { name: '' },
    { name: '   ' }, { name: 'a'.repeat(101) },
    { name: 123 }, { name: 'Hopsy', ownerId: 'invalid' },
    { name: 'Hopsy', extra: 'unexpected' },
    { name: ['Hopsy'] },
  ])('rejects invalid body %j before database access', async (payload) => {
    const response = await context.app.inject({ method: 'POST', headers: { authorization: 'Bearer verified-token' }, url: '/parties', payload });
    expect(response.statusCode).toBe(400);
    expect(context.db.user.upsert).not.toHaveBeenCalled();
    expect(context.db.party.create).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const response = await context.app.inject({ method: 'POST', url: '/parties', headers: { authorization: 'Bearer verified-token', 'content-type': 'application/json' }, payload: '{' });
    expect(response.statusCode).toBe(400);
    expect(context.db.party.create).not.toHaveBeenCalled();
  });

  it('rejects invalid route parameters before database access', async () => {
    const response = await context.app.inject({ url: '/parties/not-a-uuid', headers: { authorization: 'Bearer verified-token' } });
    expect(response.statusCode).toBe(400);
    expect(context.db.party.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown party', async () => {
    context.db.party.findUnique.mockResolvedValue(null);
    const response = await context.app.inject({ url: `/parties/${id}`, headers: { authorization: 'Bearer verified-token' } });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: 'Party not found' });
  });

  it.each(['user sync', 'create', 'retrieve'])('returns a safe 500 for failed %s', async (operation) => {
    const error = new Error('postgresql://secret:password@database:5432 SQL SELECT');
    if (operation === 'user sync') context.db.user.upsert.mockRejectedValue(error);
    if (operation === 'create') context.db.party.create.mockRejectedValue(error);
    if (operation === 'retrieve') context.db.party.findUnique.mockRejectedValue(error);
    const response = await context.app.inject(operation === 'retrieve'
      ? { method: 'GET', url: `/parties/${id}`, headers: { authorization: 'Bearer verified-token' } }
      : { method: 'POST', headers: { authorization: 'Bearer verified-token' }, url: '/parties', payload: { name: 'Hopsy' } });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ message: 'Internal server error' });
    expect(response.body).not.toContain('password');
    if (operation === 'user sync') expect(context.db.party.create).not.toHaveBeenCalled();
  });

  it('keeps the health endpoint working', async () => {
    const response = await context.app.inject('/health');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(context.verifyToken).not.toHaveBeenCalled();
    expect(context.db.user.upsert).not.toHaveBeenCalled();
  });

  it.each([undefined, 'Basic token', 'Bearer', 'Bearer a b'])('rejects missing or malformed authorization: %s', async (authorization) => {
    for (const method of ['POST', 'GET'] as const) {
      const response = await context.app.inject({ method, url: method === 'POST' ? '/parties' : `/parties/${id}`, headers: authorization ? { authorization } : {} });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ message: 'Unauthorized' });
    }
    expect(context.verifyToken).not.toHaveBeenCalled();
    expect(context.db.user.upsert).not.toHaveBeenCalled();
  });

  it.each(['expired', 'forged', 'wrong-project'])('rejects a rejected %s token without touching the database', async (token) => {
    context.verifyToken.mockResolvedValue(null);
    const response = await context.app.inject({ method: 'POST', url: '/parties', headers: { authorization: `Bearer ${token}` }, payload: { name: 'Hopsy' } });
    expect(response.statusCode).toBe(401);
    expect(context.verifyToken).toHaveBeenCalledWith(token);
    expect(context.db.user.upsert).not.toHaveBeenCalled();
    expect(context.db.party.create).not.toHaveBeenCalled();
  });

  it('rejects caller-supplied ownerId even for an authenticated user', async () => {
    const response = await context.app.inject({ method: 'POST', url: '/parties', headers: { authorization: 'Bearer verified-token' }, payload: { name: 'Hopsy', ownerId: id } });
    expect(response.statusCode).toBe(400);
    expect(context.db.party.create).not.toHaveBeenCalled();
  });

  it('uses each verified identity without leaking identity between requests', async () => {
    for (const userId of [ownerId, id, ownerId]) {
      context.verifyToken.mockResolvedValue({ id: userId });
      await context.app.inject({ method: 'POST', url: '/parties', headers: { authorization: 'Bearer token' }, payload: { name: 'Hopsy' } });
      expect(context.db.user.upsert).toHaveBeenLastCalledWith({ where: { id: userId }, create: { id: userId, name: 'Anonymous' }, update: {} });
      expect(context.db.party.create).toHaveBeenLastCalledWith({ data: { name: 'Hopsy', ownerId: userId } });
    }
  });

  it('fails safely when the authentication service is unavailable', async () => {
    context.verifyToken.mockRejectedValue(new Error('sensitive upstream response'));
    const response = await context.app.inject({ url: `/parties/${id}`, headers: { authorization: 'Bearer token' } });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ message: 'Internal server error' });
    expect(context.db.user.upsert).not.toHaveBeenCalled();
  });
});
