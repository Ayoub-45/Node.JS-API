import pg from 'pg';
import { databaseUrl } from '../config/database.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 2000
});

export default pool;