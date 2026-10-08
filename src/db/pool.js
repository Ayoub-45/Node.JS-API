import pg from 'pg';
import { databaseUrl } from '../config/database.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: databaseUrl
});

export default pool;