import 'dotenv/config';

const requiredEnv = [
  'PORT',
  'DATABASE_URL'
];

for (const name of requiredEnv) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

export const config = {
  port: Number(process.env.PORT),
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV || 'development'
};