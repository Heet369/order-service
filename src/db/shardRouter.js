const crypto = require('crypto');
const config = require('../config');

class ShardRouter {
  constructor(shardCount = config.sharding.shardCount, tablePrefix = config.sharding.tablePrefix) {
    this.shardCount = shardCount;
    this.tablePrefix = tablePrefix;
  }

  getShardId(customerId) {
    if (!customerId || typeof customerId !== 'string') {
      throw new Error(`Invalid customerId provided for sharding: "${customerId}"`);
    }
    const hash = crypto.createHash('md5').update(customerId.trim()).digest();
    const intVal = hash.readUInt32BE(0);
    return intVal % this.shardCount;
  }

  getShardTableName(customerId) {
    const shardId = this.getShardId(customerId);
    return `${this.tablePrefix}${shardId}`;
  }

  getShardTableNameById(shardId) {
    if (shardId < 0 || shardId >= this.shardCount) {
      throw new Error(`Shard index ${shardId} out of range [0, ${this.shardCount - 1}]`);
    }
    return `${this.tablePrefix}${shardId}`;
  }

  getAllShardTableNames() {
    const tables = [];
    for (let i = 0; i < this.shardCount; i++) {
      tables.push(`${this.tablePrefix}${i}`);
    }
    return tables;
  }

  getShardCount() {
    return this.shardCount;
  }
}

module.exports = new ShardRouter();
