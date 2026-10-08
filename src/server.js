import app from './app.js';
import { config } from './config/env.js';
import { pool } from './db/pool.js';

const server = app.listen(config.port, () => {
  console.log(
    `API listening on port ${config.port}`
  );
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  server.close(async () => {
    try {
      await pool.end();

      console.log('HTTP server closed');
      console.log('Database pool closed');

      process.exit(0);
    } catch (error) {
      console.error('Shutdown failed', error);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));