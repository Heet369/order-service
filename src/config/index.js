require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  
  db: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_DATABASE || 'order_service_db',
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.PG_MAX_POOL, 10) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },

  sharding: {
    shardCount: parseInt(process.env.SHARD_COUNT, 10) || 4,
    tablePrefix: process.env.SHARD_TABLE_PREFIX || 'orders_shard_',
    batchSize: parseInt(process.env.BATCH_SIZE, 10) || 500,
  },

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    bucketName: process.env.GCS_BUCKET_NAME || 'my-order-service-bucket',
    projectId: process.env.GCP_PROJECT_ID || undefined,
    localUploadDir: process.env.LOCAL_STORAGE_DIR || './uploads',
  },
};

module.exports = config;
