
import { config } from 'dotenv';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
config()
test('GET /health/live returns 200', async () => {
  const response = await request(app).get('/health/live');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('unknown routes return 404', async () => {
  const response = await request(app).get('/this-route-does-not-exist');

  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'Not Found');
});

test('GET /metrics exposes Prometheus metrics', async () => {
  const response = await request(app).get('/metrics');

  assert.equal(response.status, 200);
  assert.match(response.text, /http_requests_total/);
});
