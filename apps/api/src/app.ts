import Fastify, { type FastifyError } from 'fastify';
import { partyRoutes, type PartyDatabase } from './routes/parties.js';

export function buildApp({ db, logger = true }: { db: PartyDatabase; logger?: boolean }) {
  const app = Fastify({ logger, ajv: { customOptions: { coerceTypes: false, removeAdditional: false } } });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error.validation || error.statusCode === 400) {
      return reply.code(400).send({ message: 'Invalid request' });
    }
    // Do not log raw database errors: they may contain credentials or query data.
    request.log.error({ requestId: request.id }, 'Request failed');
    return reply.code(500).send({ message: 'Internal server error' });
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(partyRoutes, { db });

  return app;
}
