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

CREATE TABLE IF NOT EXISTS orders_shard_0 (
    order_id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    order_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_s0_cust_date ON orders_shard_0 (customer_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_s0_status ON orders_shard_0 (status);

CREATE TABLE IF NOT EXISTS orders_shard_1 (
    order_id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    order_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_s1_cust_date ON orders_shard_1 (customer_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_s1_status ON orders_shard_1 (status);

CREATE TABLE IF NOT EXISTS orders_shard_2 (
    order_id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    order_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_s2_cust_date ON orders_shard_2 (customer_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_s2_status ON orders_shard_2 (status);

CREATE TABLE IF NOT EXISTS orders_shard_3 (
    order_id VARCHAR(64) PRIMARY KEY,
    customer_id VARCHAR(64) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    order_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_s3_cust_date ON orders_shard_3 (customer_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_s3_status ON orders_shard_3 (status);
