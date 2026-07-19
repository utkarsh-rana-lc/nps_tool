import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { closePool } from './db.js';

async function main() {
  const config = loadConfig();
  const app = await buildApp(config);

  await app.listen({ port: config.port, host: '0.0.0.0' });

  const shutdown = async () => {
    await app.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
