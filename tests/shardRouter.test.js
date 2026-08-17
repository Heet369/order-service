const shardRouter = require('../src/db/shardRouter');

describe('ShardRouter', () => {
  test('should return a valid shard index between 0 and shardCount - 1', () => {
    const shardCount = shardRouter.getShardCount();
    expect(shardCount).toBeGreaterThan(0);

    const testCustomers = ['CUST-0001', 'CUST-0002', 'CUST-9999', 'USER-ALPHA', 'USER-BETA'];
    testCustomers.forEach((custId) => {
      const shardId = shardRouter.getShardId(custId);
      expect(shardId).toBeGreaterThanOrEqual(0);
      expect(shardId).toBeLessThan(shardCount);
    });
  });

  test('should be deterministic: same customer_id always maps to the same shard', () => {
    const custId = 'CUST-TEST-12345';
    const shard1 = shardRouter.getShardId(custId);
    const shard2 = shardRouter.getShardId(custId);
    const shard3 = shardRouter.getShardId(custId);

    expect(shard1).toBe(shard2);
    expect(shard2).toBe(shard3);

    const tableName1 = shardRouter.getShardTableName(custId);
    const tableName2 = shardRouter.getShardTableName(custId);
    expect(tableName1).toBe(tableName2);
    expect(tableName1).toBe(`orders_shard_${shard1}`);
  });

  test('should produce uniform distribution across all shards', () => {
    const shardCount = shardRouter.getShardCount();
    const distribution = Array(shardCount).fill(0);
    const sampleSize = 10000;

    for (let i = 0; i < sampleSize; i++) {
      const custId = `CUST-${i}`;
      const shardId = shardRouter.getShardId(custId);
      distribution[shardId]++;
    }

    const expectedAvg = sampleSize / shardCount;
    distribution.forEach((count) => {
      expect(count).toBeGreaterThan(expectedAvg * 0.7);
      expect(count).toBeLessThan(expectedAvg * 1.3);
    });
  });

  test('should throw error when invalid customer_id is provided', () => {
    expect(() => shardRouter.getShardId('')).toThrow();
    expect(() => shardRouter.getShardId(null)).toThrow();
  });
});
