const { z } = require('zod');

const rawOrderSchema = z.object({
  order_id: z.string().trim().min(1, 'order_id is required'),
  customer_id: z.string().trim().min(1, 'customer_id is required'),
  order_date: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
    message: 'order_date must be a valid ISO or date string',
  }),
  order_amount: z.union([
    z.string().trim().regex(/^-?\d+(\.\d+)?$/, 'order_amount must be a numeric value'),
    z.number(),
  ]),
  status: z.string().trim().min(1, 'status is required'),
});

function validateOrderRow(row, rowNumber) {
  try {
    const normalized = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase();
      normalized[cleanKey] = row[key];
    }

    if (normalized.order_amout !== undefined && normalized.order_amount === undefined) {
      normalized.order_amount = normalized.order_amout;
    }

    const parsed = rawOrderSchema.safeParse(normalized);

    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return {
        valid: false,
        error: `Row ${rowNumber}: Validation failed - ${errorMsg}`,
      };
    }

    const amountNum = parseFloat(parsed.data.order_amount);
    if (isNaN(amountNum) || amountNum < 0) {
      return {
        valid: false,
        error: `Row ${rowNumber}: order_amount must be a positive decimal`,
      };
    }

    return {
      valid: true,
      data: {
        order_id: parsed.data.order_id,
        customer_id: parsed.data.customer_id,
        order_date: new Date(parsed.data.order_date).toISOString(),
        order_amount: amountNum,
        status: parsed.data.status.toUpperCase(),
      },
    };
  } catch (err) {
    return {
      valid: false,
      error: `Row ${rowNumber}: Unexpected parse error: ${err.message}`,
    };
  }
}

module.exports = {
  validateOrderRow,
  rawOrderSchema,
};
