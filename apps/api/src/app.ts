import Fastify, { type FastifyError } from "fastify";
import { partyRoutes, type PartyDatabase } from "./routes/parties.js";
import type { VerifyToken } from "./lib/supabase-auth.js";

export function buildApp({
  db,
  verifyToken,
  logger = true,
}: {
  db: PartyDatabase;
  verifyToken: VerifyToken;
  logger?: boolean;
}) {
  const app = Fastify({
    logger,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const statusCode = error.validation ? 400 : error.statusCode;
    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({ message: "Invalid request" });
    }
    // Do not log raw database errors: they may contain credentials or query data.
    request.log.error({ requestId: request.id, err: error }, "Request failed");
    return reply.code(500).send({ message: "Internal server error" });
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.register(partyRoutes, { db, verifyToken });

  return app;
}
