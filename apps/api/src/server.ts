import { buildApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { createTokenVerifier } from './lib/supabase-auth.js';

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set');
}
const app = buildApp({ db: prisma, verifyToken: createTokenVerifier(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) });
app.addHook('onClose', async () => { await prisma.$disconnect(); });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    try {
      await app.close();
    } catch (error) {
      app.log.error(error);
      process.exitCode = 1;
    }
  });
}

try {
  await app.listen({
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 3000),
  });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
