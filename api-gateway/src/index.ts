import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './server';

async function main(): Promise<void> {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const app = createApp();

  app.listen(port, () => {
    console.log(`API Gateway listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  // Fail fast on startup errors
  console.error('Failed to start API Gateway', err);
  process.exit(1);
});
