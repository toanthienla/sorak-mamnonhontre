import cron from 'node-cron';
import { createApp } from './app.js';
import { env } from './config/env.js';
import logger from './utils/logger.js';
import prisma from './config/prisma.js';
import { applyDueTransfers } from './services/class-transfers.service.js';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`🚀 Sorak API (Express) running at http://localhost:${env.port}`);
});

// BR-071: apply approved class transfers on their effective date
// Run once at boot (catch up after downtime) + daily at 00:05
applyDueTransfers().catch((err) => logger.error(`applyDueTransfers boot: ${err.message}`));
cron.schedule('5 0 * * *', () => {
  applyDueTransfers().catch((err) => logger.error(`applyDueTransfers cron: ${err.message}`));
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
