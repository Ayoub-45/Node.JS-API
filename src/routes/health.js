
import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

// Liveness: Is the application process responsive?
// This endpoint deliberately does not query PostgreSQL.
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'ok'
  });
});

// Backward compatibility with the existing /health endpoint.
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok'
  });
});

// Readiness: Can this instance access its database?
router.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    return res.status(200).json({
      status: 'ready',
      checks: {
        database: 'ok'
      }
    });
  } catch (err) {
    req.log?.warn(
      { err },
      'Readiness check failed: database unavailable'
    );

    return res.status(503).json({
      status: 'not_ready',
      checks: {
        database: 'unavailable'
      }
    });
  }
});

export default router;