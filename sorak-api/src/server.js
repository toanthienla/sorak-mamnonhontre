import { createApp } from './app.js';
import { env } from './config/env.js';
import logger from './utils/logger.js';
import prisma from './config/prisma.js';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`🚀 Sorak API (Express) running at http://localhost:${env.port}`);
});

const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
