# Scalable Order Ingestion & Sharded PostgreSQL Backend Service

A high-performance, horizontally scalable Node.js backend service designed to ingest large order datasets (~10,000+ records), stream files to Google Cloud Storage (GCS) using Google Application Default Credentials (ADC), and partition data across PostgreSQL shards using application-level consistent hashing.

---

## 1. Architecture Overview

```
                      +------------------------------------------+
                      |         HTTP Client / Postman            |
                      +------------------------------------------+
                                           |
                                  POST /upload-orders
                                  (multipart/form-data)
                                           v
                      +------------------------------------------+
                      |       Express & Busboy Stream Engine     |
                      +------------------------------------------+
                                     /            \
                       (Stream to Cloud)        (Stream to Parser)
                                   /                \
                                  v                  v
    +------------------------------------+    +------------------------------------+
    |    Google Cloud Storage (ADC)      |    |   csv-parser Streaming Pipeline    |
    | gs://bucket/orders_timestamp.csv   |    +------------------------------------+
    +------------------------------------+                   |
                                                    Row Validation (Zod)
                                                             |
                                                    Shard Router (Hash mod N)
                                                             |
                                              +--------------+--------------+
                                              |       Batch Accumulator     |
                                              +--------------+--------------+
                                              /       |              |       \
                                             /        |              |        \
                                            v         v              v         v
                                     [Shard 0]    [Shard 1]      [Shard 2]  [Shard 3]
                                   orders_shard_0 orders_shard_1 orders_shard_2 orders_shard_3
```

---

## 2. Sharding Strategy & Design Decisions

### 2.1 Shard Key Selection: `customer_id`
- **Why `customer_id`?**
  - **Co-located Customer Queries**: Querying customer history (`GET /orders?customerId=CUST-00042`) hits **exactly 1 shard** ($O(1)$ single-shard routing). No cross-shard scatter-gather query is needed.
  - **Uniform Distribution**: Customer IDs hashed via MD5 produce an even spread across all shard tables.
  - **Data Locality**: Related customer transactions reside on the same partition.

### 2.2 Routing Logic
```javascript
getShardId(customerId) {
  const hash = crypto.createHash('md5').update(customerId.trim()).digest();
  const intVal = hash.readUInt32BE(0);
  return intVal % this.shardCount;
}
```

### 2.3 Batch Inserts & Memory Efficiency
- **Streaming Pipeline**: File is processed chunk-by-chunk using Node.js streams (`busboy` $\to$ `csv-parser`). Memory footprint remains constant ($O(1)$) regardless of whether the file has 10,000 or 1,000,000 rows.
- **Micro-Batches**: Validated rows are accumulated into per-shard memory buffers of 500 rows (`BATCH_SIZE=500`). When a shard buffer reaches capacity, backpressure pauses the stream while a single multi-row `INSERT ... ON CONFLICT` executes inside a database transaction.

---

## 3. Google Cloud Storage & ADC Integration

The service utilizes `@google-cloud/storage` with **Application Default Credentials (ADC)**. No service account keys or passwords are hardcoded in the codebase.

### How Google ADC Works:
1. **Service Account Key (Recommended for Local Dev & CI/CD)**:
   Set the standard Google ADC environment variable pointing to your downloaded key:
   - **Windows (PowerShell)**:
     ```powershell
     $env:GOOGLE_APPLICATION_CREDENTIALS="H:\order-service\gcp-key.json"
     ```
   - **Windows (Command Prompt / CMD)**:
     ```cmd
     set GOOGLE_APPLICATION_CREDENTIALS=H:\order-service\gcp-key.json
     ```
   - **Linux / macOS (Bash)**:
     ```bash
     export GOOGLE_APPLICATION_CREDENTIALS="/path/to/gcp-key.json"
     ```
2. **Local Development (gcloud CLI)**:
   Run:
   ```bash
   gcloud auth application-default login
   ```
3. **GCP Production (Cloud Run / GKE / GCE)**:
   Credentials are automatically obtained from the instance metadata service via Workload Identity (zero configuration needed).
4. **Local Fallback Mode (`STORAGE_DRIVER=local`)**:
   If running offline without GCP credentials, set `STORAGE_DRIVER=local` in `.env` to store uploaded files in `./uploads/`.

---

## 4. Local PostgreSQL Setup

1. Install PostgreSQL on your PC using the official installer from [postgresql.org](https://www.postgresql.org/download/windows/) (includes **pgAdmin 4**).
2. Open **pgAdmin 4** (or `psql`) and create the database:
   ```sql
   CREATE DATABASE order_service_db;
   ```
3. Set your PostgreSQL password and credentials in `.env`.

---

## 5. Getting Started & Setup Guide

### Prerequisites
- **Node.js**: v18+ (Tested on Node v20/v24)
- **PostgreSQL**: v12+

### Step 1: Clone and Install Dependencies
```bash
git clone <repo-url>
cd order-service
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` and adjust database credentials and GCS settings:
```bash
cp .env.example .env
```

### Step 3: Initialize Database & Shard Tables
Run the automated migration script to create `upload_audit_logs` and all shard tables (`orders_shard_0` ... `orders_shard_3`) with appropriate indexes:
```bash
npm run db:init
```

### Step 4: Generate 10,000 Sample Orders
Generate a 10,000-record CSV test file:
```bash
# Generate 10,000 clean orders
node scripts/generate_orders.js 10000 sample_orders_10k.csv

# Or generate 10,000 orders with 1% invalid records to test error handling
node scripts/generate_orders.js 10000 sample_orders_with_errors.csv --with-invalid
```

### Step 5: Start the Server

**When using Google Cloud Storage (ADC):**
- **Windows (PowerShell)**:
  ```powershell
  $env:GOOGLE_APPLICATION_CREDENTIALS="H:\order-service\gcp-key.json"
  npm start
  ```
- **Windows (Command Prompt / CMD)**:
  ```cmd
  set GOOGLE_APPLICATION_CREDENTIALS=H:\order-service\gcp-key.json
  npm start
  ```
- **Linux / macOS**:
  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/gcp-key.json"
  npm start
  ```

**When using Local Storage (`STORAGE_DRIVER=local`):**
```bash
npm start
```

---

## 6. API Reference & Swagger UI

### Interactive Swagger UI
Once the server is running, you can access the interactive Swagger UI in your browser to test all endpoints:
 **`http://localhost:3000/api-docs`**

---

### 1. Upload & Ingest Orders
- **Endpoint**: `POST /upload-orders`
- **Content-Type**: `multipart/form-data`
- **Body**: Form-data field `file` containing the `.csv` file.

**Sample Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Order file processed and stored successfully across shards",
  "data": {
    "status": "SUCCESS",
    "storage": {
      "driver": "gcs",
      "storage_path": "gs://order-vault-505818/orders_sample_orders_10k_1786976374043_1204.csv",
      "destination_file_name": "orders_sample_orders_10k_1786976374043_1204.csv"
    },
    "metrics": {
      "total_records": 10000,
      "successful_records": 10000,
      "failed_records": 0,
      "duration_ms": 420,
      "records_per_second": 23809.52
    },
    "shard_distribution": {
      "orders_shard_0": 2514,
      "orders_shard_1": 2489,
      "orders_shard_2": 2503,
      "orders_shard_3": 2494
    },
    "validation_errors": []
  }
}
```

### 2. Get Customer Orders (Bonus - Single Shard Routing)
- **Endpoint**: `GET /orders?customerId=CUST-00042&limit=10&offset=0`
- **Query Parameters**:
  - `customerId` *(required)*: The unique customer identifier. The router uses this to target the exact shard.
  - `limit` *(optional, default: 50)*: Number of order records to return per page.
  - `offset` *(optional, default: 0)*: Number of records to skip from the beginning (used for pagination).
- **Response**:
```json
{
  "success": true,
  "data": {
    "customerId": "CUST-00042",
    "routedShard": "orders_shard_2",
    "shardId": 2,
    "total": 12,
    "limit": 10,
    "offset": 0,
    "orders": [
      {
        "order_id": "ORD-1786976374043-A3A8D7F6",
        "customer_id": "CUST-00042",
        "order_date": "2026-05-10T14:20:00.000Z",
        "order_amount": "249.99",
        "status": "COMPLETED",
        "created_at": "2026-08-17T14:30:00.000Z"
      }
    ]
  }
}
```

### 3. Get Order by ID (Bonus - Cross Shard Lookup)
- **Endpoint**: `GET /orders/ORD-1786976374043-A3A8D7F6`
- **Response**:
```json
{
  "success": true,
  "data": {
    "order_id": "ORD-1786976374043-A3A8D7F6",
    "customer_id": "CUST-00042",
    "order_date": "2026-05-10T14:20:00.000Z",
    "order_amount": "249.99",
    "status": "COMPLETED",
    "shard_table": "orders_shard_2"
  }
}
```

---

## 7. Running Automated Tests

Run the test suite using Jest:
```bash
npm test
```

---

## 8. Project Structure

```
order-service/
├── .env.example                # Example configuration
├── .gitignore                  # Git ignore rules
├── package.json                # Project manifest & dependencies
├── README.md                   # Complete system documentation & testing guide
├── scripts/
│   └── generate_orders.js      # 10,000+ sample CSV dataset generator
├── src/
│   ├── app.js                  # Express app setup & middleware
│   ├── server.js               # Server bootstrap & graceful shutdown
│   ├── config/
│   │   └── index.js            # Centralized environment config
│   ├── controllers/
│   │   └── orderController.js  # Request handlers
│   ├── db/
│   │   ├── pool.js             # PostgreSQL connection pool & batch writer
│   │   ├── schema.sql          # SQL schema DDL
│   │   ├── migrate.js          # Database migration runner
│   │   └── shardRouter.js      # Consistent hashing & shard router
│   ├── docs/
│   │   └── swagger.json        # OpenAPI 3.0 specification
│   ├── routes/
│   │   └── orderRoutes.js      # Express API routes
│   ├── services/
│   │   ├── orderService.js     # Streaming CSV parser & ingestion engine
│   │   └── storageService.js   # GCS (ADC) & local storage driver
│   └── utils/
│       ├── logger.js           # Winston logger
│       └── validator.js        # Zod row validation & sanitization
└── tests/
    ├── orderIntegration.test.js# API integration tests
    ├── shardRouter.test.js     # Shard distribution & hashing unit tests
    └── validator.test.js       # Row validation unit tests
```
