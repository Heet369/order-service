const { pool } = require('./pool');
const shardRouter = require('./shardRouter');
const logger = require('../utils/logger');

async function runMigrations() {
  logger.info('Starting database migration...');
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS upload_audit_logs (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        file_size_bytes BIGINT,
        storage_path TEXT NOT NULL,
        storage_driver VARCHAR(50) NOT NULL,
        total_records INT DEFAULT 0,
        successful_records INT DEFAULT 0,
        failed_records INT DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'PROCESSING',
        error_summary TEXT,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE
      );
    `);

    const shardCount = shardRouter.getShardCount();
    for (let i = 0; i < shardCount; i++) {
      const tableName = shardRouter.getShardTableNameById(i);
      
      const createTableSql = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          order_id VARCHAR(64) PRIMARY KEY,
          customer_id VARCHAR(64) NOT NULL,
          order_date TIMESTAMP WITH TIME ZONE NOT NULL,
          order_amount NUMERIC(12, 2) NOT NULL,
          status VARCHAR(50) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await client.query(createTableSql);

      const createCustIndexSql = `
        CREATE INDEX IF NOT EXISTS idx_${tableName}_cust_date 
        ON ${tableName} (customer_id, order_date DESC);
      `;
      await client.query(createCustIndexSql);

      const createStatusIndexSql = `
        CREATE INDEX IF NOT EXISTS idx_${tableName}_status 
        ON ${tableName} (status);
      `;
      await client.query(createStatusIndexSql);
    }

    logger.info('Database migration completed successfully.');
  } catch (err) {
    logger.error('Database migration failed', { error: err.message, stack: err.stack });
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration failed', { error: err.message });
      process.exit(1);
    });
}

module.exports = { runMigrations };
