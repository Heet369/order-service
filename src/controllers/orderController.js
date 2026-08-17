const Busboy = require('busboy');
const orderService = require('../services/orderService');
const logger = require('../utils/logger');

class OrderController {
  async uploadOrders(req, res, next) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid Content-Type. Request must be multipart/form-data with a file field.',
      });
    }

    try {
      const busboy = Busboy({
        headers: req.headers,
        limits: {
          files: 1,
          fileSize: 100 * 1024 * 1024,
        },
      });

      let fileFound = false;
      let processingPromise = null;

      busboy.on('file', (name, fileStream, info) => {
        const { filename, mimeType } = info;
        fileFound = true;

        if (!filename.toLowerCase().endsWith('.csv') && mimeType !== 'text/csv' && mimeType !== 'application/vnd.ms-excel') {
          fileStream.resume();
          return res.status(400).json({
            status: 'ERROR',
            message: 'Invalid file format. Only CSV files (.csv) are supported for order ingestion.',
          });
        }

        processingPromise = orderService.processOrderStream(fileStream, {
          originalFilename: filename,
        });
      });

      busboy.on('error', (err) => {
        logger.error(`Busboy error: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ status: 'ERROR', message: `File upload error: ${err.message}` });
        }
      });

      busboy.on('finish', async () => {
        if (!fileFound) {
          return res.status(400).json({
            status: 'ERROR',
            message: 'No file provided. Please attach a CSV file in form field "file".',
          });
        }

        try {
          const result = await processingPromise;
          return res.status(200).json({
            success: true,
            message: 'Order file processed and stored successfully across shards',
            data: result,
          });
        } catch (err) {
          logger.error('Error during order ingestion execution', { error: err.message });
          if (!res.headersSent) {
            return res.status(500).json({
              status: 'ERROR',
              message: `Order processing failed: ${err.message}`,
            });
          }
        }
      });

      req.pipe(busboy);
    } catch (err) {
      next(err);
    }
  }

  async getOrderById(req, res, next) {
    try {
      const { orderId } = req.params;
      const order = await orderService.getOrderById(orderId);

      if (!order) {
        return res.status(404).json({
          status: 'ERROR',
          message: `Order with ID "${orderId}" not found in any shard.`,
        });
      }

      return res.status(200).json({
        success: true,
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }

  async getOrders(req, res, next) {
    try {
      const { customerId, limit = 50, offset = 0 } = req.query;

      if (!customerId) {
        return res.status(400).json({
          status: 'ERROR',
          message: 'Query parameter "customerId" is required.',
        });
      }

      const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
      const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

      const result = await orderService.getOrdersByCustomerId(customerId, parsedLimit, parsedOffset);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OrderController();
