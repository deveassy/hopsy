import { buildApp } from './app.js';
import { prisma } from './lib/prisma.js';

const app = buildApp({ db: prisma });
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
