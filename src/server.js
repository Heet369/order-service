const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { healthCheck, closePool } = require('./db/pool');

const PORT = config.port;

const server = app.listen(PORT, async () => {
  logger.info(`Order Ingestion Service running on port ${PORT}`);

  const dbHealth = await healthCheck();
  if (dbHealth.ok) {
    logger.info(`PostgreSQL connected successfully.`);
  } else {
    logger.error(`PostgreSQL connection failed: ${dbHealth.error}`);
  }
});

const gracefulShutdown = async (signal) => {
  server.close(async () => {
    try {
      await closePool();
    } catch (err) {
      logger.error('Error closing database pool', { error: err.message });
    }
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
