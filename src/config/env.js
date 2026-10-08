export const getEnv = (name, defaultValue = undefined) => {
  const value = process.env[name] ?? defaultValue;

  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',

  port: Number(getEnv('PORT', '3000')),

  databaseUrl: getEnv('DATABASE_URL')
};