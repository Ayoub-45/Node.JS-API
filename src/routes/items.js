import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, description, created_at, updated_at
      FROM items
      ORDER BY id DESC
      `
    );

    res.json({
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, description, created_at, updated_at
      FROM items
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Item not found'
      });
    }

    res.json({
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'name is required'
      });
    }

    const result = await pool.query(
      `
      INSERT INTO items (name, description)
      VALUES ($1, $2)
      RETURNING id, name, description, created_at, updated_at
      `,
      [name, description ?? null]
    );

    res.status(201).json({
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

export default router;