const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');
const shardRouter = require('./shardRouter');

const pool = new Pool(config.db);

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message, stack: err.stack });
});

async function query(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    logger.error('DB query error', { text, error: err.message });
    throw err;
  }
}

async function insertOrderBatch(tableName, orders) {
  if (!orders || orders.length === 0) return 0;

  const validTables = shardRouter.getAllShardTableNames();
  if (!validTables.includes(tableName)) {
    throw new Error(`Invalid shard table name: "${tableName}"`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const valuePlaceholders = [];
    const values = [];
    let paramIndex = 1;

    for (const order of orders) {
      valuePlaceholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`
      );
      values.push(
        order.order_id,
        order.customer_id,
        order.order_date,
        order.order_amount,
        order.status
      );
      paramIndex += 5;
    }

    const insertSql = `
      INSERT INTO ${tableName} (order_id, customer_id, order_date, order_amount, status)
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (order_id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        order_date = EXCLUDED.order_date,
        order_amount = EXCLUDED.order_amount,
        status = EXCLUDED.status;
    `;

    const result = await client.query(insertSql, values);
    await client.query('COMMIT');
    return result.rowCount;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`Batch insert failed on ${tableName}`, { error: err.message, batchCount: orders.length });
    throw err;
  } finally {
    client.release();
  }
}

async function healthCheck() {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message };
  }
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  insertOrderBatch,
  healthCheck,
  closePool,
};
