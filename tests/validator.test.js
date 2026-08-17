const { validateOrderRow } = require('../src/utils/validator');

describe('Order Validator', () => {
  test('should successfully validate a standard valid row', () => {
    const rawRow = {
      order_id: 'ORD-1001',
      customer_id: 'CUST-001',
      order_date: '2026-08-10T14:30:00.000Z',
      order_amount: '129.50',
      status: 'COMPLETED',
    };

    const res = validateOrderRow(rawRow, 1);
    expect(res.valid).toBe(true);
    expect(res.data.order_id).toBe('ORD-1001');
    expect(res.data.customer_id).toBe('CUST-001');
    expect(res.data.order_amount).toBe(129.5);
    expect(res.data.status).toBe('COMPLETED');
  });

  test('should handle assessment document field typo "order_amout"', () => {
    const rawRow = {
      order_id: 'ORD-1002',
      customer_id: 'CUST-002',
      order_date: '2026-08-11T10:00:00Z',
      order_amout: '88.20',
      status: 'pending',
    };

    const res = validateOrderRow(rawRow, 2);
    expect(res.valid).toBe(true);
    expect(res.data.order_amount).toBe(88.2);
    expect(res.data.status).toBe('PENDING');
  });

  test('should fail on invalid date format', () => {
    const rawRow = {
      order_id: 'ORD-1003',
      customer_id: 'CUST-003',
      order_date: 'NOT_A_DATE',
      order_amount: '50.00',
      status: 'PENDING',
    };

    const res = validateOrderRow(rawRow, 3);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('order_date');
  });

  test('should fail on negative order_amount', () => {
    const rawRow = {
      order_id: 'ORD-1004',
      customer_id: 'CUST-004',
      order_date: '2026-08-11T10:00:00Z',
      order_amount: '-25.00',
      status: 'PENDING',
    };

    const res = validateOrderRow(rawRow, 4);
    expect(res.valid).toBe(false);
  });

  test('should fail on missing order_id or customer_id', () => {
    const rawRow = {
      order_id: '',
      customer_id: 'CUST-005',
      order_date: '2026-08-11T10:00:00Z',
      order_amount: '10.00',
      status: 'PENDING',
    };

    const res = validateOrderRow(rawRow, 5);
    expect(res.valid).toBe(false);
  });
});
