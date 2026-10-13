
import { Router } from 'express';

export function createItemsRouter({ pool, logger }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      logger.info({ operation: 'list_items' }, 'Fetching items');

      const result = await pool.query(`
        SELECT id, name, description, created_at, updated_at
        FROM items
        ORDER BY id DESC
      `);

      res.json({ data: result.rows });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    const id = Number(req.params.id);

if (!Number.isSafeInteger(id) || id <= 0) {
  return res.status(400).json({
    error: 'id must be a positive integer'
  });
}
    try {
      const result = await pool.query(
        `SELECT id, name, description, created_at, updated_at
         FROM items
         WHERE id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json({ data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      logger.info({ operation: 'post_item' }, 'Posting item');

      const { name, description } = req.body ?? {};

      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name is required' });
      }
      if (
  description !== undefined &&
  description !== null &&
  (typeof description !== 'string' || description.length > 2000)
) {
  return res.status(400).json({
    error: 'description must be a string of at most 2000 characters'
  });
}

      const result = await pool.query(
        `INSERT INTO items (name, description)
         VALUES ($1, $2)
         RETURNING id, name, description, created_at, updated_at`,
        [name.trim(), description ?? null]
      );

      res.status(201).json({ data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
