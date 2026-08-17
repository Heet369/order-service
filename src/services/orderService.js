const { PassThrough } = require('stream');
const csv = require('csv-parser');
const shardRouter = require('../db/shardRouter');
const { insertOrderBatch, query } = require('../db/pool');
const storageService = require('./storageService');
const { validateOrderRow } = require('../utils/validator');
const logger = require('../utils/logger');
const config = require('../config');

class OrderService {
  async processOrderStream(fileStream, fileMetadata = {}) {
    const startTime = Date.now();
    const destinationFileName = storageService.generateUniqueFileName(fileMetadata.originalFilename);
    const { writeStream: storageWriteStream, storagePath, driver } = storageService.createWriteStream(destinationFileName);

    let auditLogId = null;
    try {
      const auditRes = await query(
        `INSERT INTO upload_audit_logs (file_name, storage_path, storage_driver, status)
         VALUES ($1, $2, $3, 'PROCESSING') RETURNING id`,
        [fileMetadata.originalFilename || destinationFileName, storagePath, driver]
      );
      auditLogId = auditRes.rows[0]?.id;
    } catch (err) {
      logger.error('Failed to create initial audit log', { error: err.message });
    }

    const storagePassThrough = new PassThrough();
    const parserPassThrough = new PassThrough();

    fileStream.pipe(storagePassThrough);
    fileStream.pipe(parserPassThrough);

    const storageUploadPromise = new Promise((resolve, reject) => {
      storagePassThrough
        .pipe(storageWriteStream)
        .on('finish', () => {
          resolve(storagePath);
        })
        .on('error', (err) => {
          logger.error(`Storage write stream error: ${err.message}`, { error: err });
          reject(err);
        });
    });

    const shardCount = shardRouter.getShardCount();
    const shardBuffers = Array.from({ length: shardCount }, () => []);
    const shardInsertCounts = Array.from({ length: shardCount }, () => 0);
    const batchSize = config.sharding.batchSize;

    let totalRows = 0;
    let successfulRows = 0;
    let failedRows = 0;
    const errorDetails = [];
    const maxLoggedErrors = 50;

    const flushShardBuffer = async (shardId) => {
      const buffer = shardBuffers[shardId];
      if (!buffer || buffer.length === 0) return;

      const recordsToInsert = buffer.splice(0, buffer.length);
      const tableName = shardRouter.getShardTableNameById(shardId);
      
      const inserted = await insertOrderBatch(tableName, recordsToInsert);
      shardInsertCounts[shardId] += inserted;
      successfulRows += inserted;
    };

    const csvProcessingPromise = new Promise((resolve, reject) => {
      const csvStream = parserPassThrough.pipe(
        csv({
          mapHeaders: ({ header }) => header.trim(),
          skipEmptyLines: true,
        })
      );

      csvStream.on('data', async (row) => {
        totalRows++;
        const currentRowNumber = totalRows;

        const validation = validateOrderRow(row, currentRowNumber);
        if (!validation.valid) {
          failedRows++;
          if (errorDetails.length < maxLoggedErrors) {
            errorDetails.push({ row: currentRowNumber, error: validation.error });
          }
          return;
        }

        const orderData = validation.data;
        const shardId = shardRouter.getShardId(orderData.customer_id);
        shardBuffers[shardId].push(orderData);

        if (shardBuffers[shardId].length >= batchSize) {
          csvStream.pause();
          try {
            await flushShardBuffer(shardId);
          } catch (err) {
            csvStream.destroy(err);
            return;
          } finally {
            csvStream.resume();
          }
        }
      });

      csvStream.on('end', async () => {
        try {
          const flushPromises = [];
          for (let i = 0; i < shardCount; i++) {
            if (shardBuffers[i].length > 0) {
              flushPromises.push(flushShardBuffer(i));
            }
          }
          await Promise.all(flushPromises);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      csvStream.on('error', (err) => {
        logger.error(`CSV Parsing stream error: ${err.message}`);
        reject(err);
      });
    });

    try {
      await Promise.all([storageUploadPromise, csvProcessingPromise]);
      const durationMs = Date.now() - startTime;

      const shardDistribution = {};
      for (let i = 0; i < shardCount; i++) {
        shardDistribution[shardRouter.getShardTableNameById(i)] = shardInsertCounts[i];
      }

      if (auditLogId) {
        await query(
          `UPDATE upload_audit_logs 
           SET total_records = $1, successful_records = $2, failed_records = $3, 
               status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [totalRows, successfulRows, failedRows, auditLogId]
        );
      }

      return {
        status: 'SUCCESS',
        storage: {
          driver,
          storage_path: storagePath,
          destination_file_name: destinationFileName,
        },
        metrics: {
          total_records: totalRows,
          successful_records: successfulRows,
          failed_records: failedRows,
          duration_ms: durationMs,
          records_per_second: totalRows > 0 ? Math.round((totalRows / (durationMs / 1000)) * 100) / 100 : 0,
        },
        shard_distribution: shardDistribution,
        validation_errors: errorDetails,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      if (auditLogId) {
        await query(
          `UPDATE upload_audit_logs 
           SET status = 'FAILED', error_summary = $1, completed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [err.message, auditLogId]
        );
      }
      logger.error('Order processing pipeline encountered an error', { error: err.message, stack: err.stack });
      throw err;
    }
  }

  async getOrdersByCustomerId(customerId, limit = 50, offset = 0) {
    if (!customerId) {
      throw new Error('customerId is required');
    }

    const shardTableName = shardRouter.getShardTableName(customerId);
    const shardId = shardRouter.getShardId(customerId);

    const countRes = await query(
      `SELECT COUNT(*) as total FROM ${shardTableName} WHERE customer_id = $1`,
      [customerId]
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const ordersRes = await query(
      `SELECT order_id, customer_id, order_date, order_amount, status, created_at
       FROM ${shardTableName} 
       WHERE customer_id = $1 
       ORDER BY order_date DESC 
       LIMIT $2 OFFSET $3`,
      [customerId, limit, offset]
    );

    return {
      customerId,
      routedShard: shardTableName,
      shardId,
      total,
      limit,
      offset,
      orders: ordersRes.rows,
    };
  }

  async getOrderById(orderId) {
    if (!orderId) {
      throw new Error('orderId is required');
    }

    const shardTables = shardRouter.getAllShardTableNames();
    const queryPromises = shardTables.map((tableName) =>
      query(
        `SELECT order_id, customer_id, order_date, order_amount, status, created_at, '${tableName}' as shard_table 
         FROM ${tableName} WHERE order_id = $1`,
        [orderId]
      )
    );

    const results = await Promise.all(queryPromises);
    for (const res of results) {
      if (res.rows && res.rows.length > 0) {
        return res.rows[0];
      }
    }

    return null;
  }
}

module.exports = new OrderService();
