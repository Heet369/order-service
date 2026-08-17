const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { closePool } = require('../src/db/pool');

describe('Order Service API Endpoints', () => {
  afterAll(async () => {
    await closePool();
  });

  describe('GET /api-docs', () => {
    test('should serve Swagger UI documentation', async () => {
      const res = await request(app).get('/api-docs/');
      expect([200, 301]).toContain(res.status);
    });
  });
    test('should reject request without multipart content-type', async () => {
      const res = await request(app)
        .post('/upload-orders')
        .send({ dummy: 'data' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('ERROR');
      expect(res.body.message).toContain('multipart/form-data');
    });

    test('should reject request without any file attached', async () => {
      const res = await request(app)
        .post('/upload-orders')
        .set('Content-Type', 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW')
        .send('------WebKitFormBoundary7MA4YWxkTrZu0gW--');

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('ERROR');
      expect(res.body.message).toContain('No file provided');
    });
  });

  describe('GET /orders Validation', () => {
    test('should require customerId query parameter', async () => {
      const res = await request(app).get('/orders');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('customerId');
    });
  });
});
