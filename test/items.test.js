
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

import { createItemsRouter } from '../src/routes/items.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

function buildApp(query) {
  const app = express();
  app.use(express.json());

  const pool = { query };
  const logger = {
    info() {},
  };

  // The error handler expects req.log to exist.
  app.use((req, res, next) => {
    req.log = {
      error() {},
    };
    next();
  });

  app.use(
    '/api/v1/items',
    createItemsRouter({ pool, logger })
  );

  app.use(errorHandler);
  return app;
}

const sampleItem = {
  id: 1,
  name: 'Test item',
  description: 'Test description',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

test('GET /api/v1/items returns items', async () => {
  const app = buildApp(async () => ({
    rows: [sampleItem],
  }));

  const response = await request(app).get('/api/v1/items');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, [sampleItem]);
});

test('GET /api/v1/items/:id returns an existing item', async () => {
  const app = buildApp(async (sql, values) => {
    assert.deepEqual(values, ['1']);
    return { rows: [sampleItem] };
  });

  const response = await request(app).get('/api/v1/items/1');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, sampleItem);
});

test('GET /api/v1/items/:id returns 404 when absent', async () => {
  const app = buildApp(async () => ({ rows: [] }));

  const response = await request(app).get('/api/v1/items/999');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'Item not found' });
});

test('POST /api/v1/items creates an item', async () => {
  const app = buildApp(async (sql, values) => {
    assert.deepEqual(values, ['New item', null]);
    return { rows: [{ ...sampleItem, name: 'New item', description: null }] };
  });

  const response = await request(app)
    .post('/api/v1/items')
    .send({ name: 'New item' });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.name, 'New item');
});

test('POST /api/v1/items rejects an empty name', async () => {
  let queryCalled = false;
  const app = buildApp(async () => {
    queryCalled = true;
    return { rows: [] };
  });

  const response = await request(app)
    .post('/api/v1/items')
    .send({ name: '   ' });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'name is required' });
  assert.equal(queryCalled, false);
});

test('database failures return a generic 500 response', async () => {
  const app = buildApp(async () => {
    throw new Error('Simulated database failure');
  });

  const response = await request(app).get('/api/v1/items');

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    error: 'Internal Server Error',
  });

  assert.equal(
    JSON.stringify(response.body).includes('Simulated database failure'),
    false
  );
});
