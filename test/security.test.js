import { config } from 'dotenv';
config()

import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
test('responses include security headers', async () => {
  const response = await request(app).get('/health/live');

  assert.equal(response.status, 200);
  assert.equal(response.headers['x-powered-by'], undefined);
  assert.ok(response.headers['x-content-type-options']);
  assert.ok(response.headers['x-frame-options']);
});
