const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const config = require('../config');

class StorageService {
  constructor() {
    this.driver = config.storage.driver;
    this.bucketName = config.storage.bucketName;
    this.localDir = path.resolve(config.storage.localUploadDir);

    if (this.driver === 'gcs') {
      const storageOptions = {};
      if (config.storage.projectId) {
        storageOptions.projectId = config.storage.projectId;
      }
      this.gcsClient = new Storage(storageOptions);
      this.bucket = this.gcsClient.bucket(this.bucketName);
    } else {
      if (!fs.existsSync(this.localDir)) {
        fs.mkdirSync(this.localDir, { recursive: true });
      }
    }
  }

  createWriteStream(destinationFileName) {
    if (this.driver === 'gcs') {
      const file = this.bucket.file(destinationFileName);
      const writeStream = file.createWriteStream({
        resumable: false,
        contentType: 'text/csv',
        metadata: {
          uploadedAt: new Date().toISOString(),
        },
      });

      const storagePath = `gs://${this.bucketName}/${destinationFileName}`;
      return {
        writeStream,
        storagePath,
        driver: 'gcs',
      };
    } else {
      const filePath = path.join(this.localDir, destinationFileName);
      const writeStream = fs.createWriteStream(filePath);
      return {
        writeStream,
        storagePath: filePath,
        driver: 'local',
      };
    }
  }

  generateUniqueFileName(originalName = 'orders.csv') {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const ext = path.extname(originalName) || '.csv';
    const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `orders_${base}_${timestamp}_${randomSuffix}${ext}`;
  }
}

module.exports = new StorageService();
