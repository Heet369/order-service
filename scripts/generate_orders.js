const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const count = parseInt(process.argv[2], 10) || 10000;
const outputFile = process.argv[3] || 'sample_orders_10k.csv';
const includeInvalid = process.argv.includes('--with-invalid');

const outputPath = path.resolve(process.cwd(), outputFile);
const writeStream = fs.createWriteStream(outputPath);

writeStream.write('order_id,customer_id,order_date,order_amount,status\n');

const statuses = ['PENDING', 'COMPLETED', 'SHIPPED', 'CANCELLED', 'DELIVERED', 'PROCESSING'];
const numCustomers = Math.max(100, Math.floor(count / 10));

const startDate = new Date('2025-01-01T00:00:00.000Z').getTime();
const endDate = new Date('2026-08-15T00:00:00.000Z').getTime();

let validCount = 0;
let invalidCount = 0;

for (let i = 1; i <= count; i++) {
  const isInvalid = includeInvalid && i % 100 === 0;

  if (isInvalid) {
    invalidCount++;
    const errorType = i % 3;
    if (errorType === 0) {
      writeStream.write(`ORD-INV-${i},CUST-001,INVALID_DATE_FORMAT,99.99,PENDING\n`);
    } else if (errorType === 1) {
      writeStream.write(`ORD-INV-${i},CUST-002,2026-05-10T10:00:00Z,-50.00,COMPLETED\n`);
    } else {
      writeStream.write(`ORD-INV-${i},,2026-05-10T10:00:00Z,120.00,PENDING\n`);
    }
  } else {
    validCount++;
    const orderId = `ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const custNum = Math.floor(Math.random() * numCustomers) + 1;
    const customerId = `CUST-${String(custNum).padStart(5, '0')}`;
    const randomTime = new Date(startDate + Math.random() * (endDate - startDate)).toISOString();
    const amount = (Math.random() * 500 + 10).toFixed(2);
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    writeStream.write(`${orderId},${customerId},${randomTime},${amount},${status}\n`);
  }
}

writeStream.end(() => {
  const stats = fs.statSync(outputPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`Generated ${count} records (${validCount} valid, ${invalidCount} invalid) -> ${outputFile} (${sizeMb} MB)`);
});
