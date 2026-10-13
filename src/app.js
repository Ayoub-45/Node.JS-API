import express from 'express';
import pinoHttp from 'pino-http';
import healthRouter from './routes/health.js';
import { createItemsRouter } from './routes/items.js';
import { pool } from './db/pool.js';
import { logger } from './middleware/requestLogger.js';import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import {
  register,
  httpMetricsMiddleware,
} from './observability/metrics.js';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
const app = express();
app.disable('x-powered-by');
app.use(helmet());
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.'
  }
});
app.use(express.json({ limit: '100kb' }));
app.use(express.json());

app.use(
    pinoHttp({
        level: 'info'
    })
);
app.use(requestLogger)
app.use(httpMetricsMiddleware);
app.use('/health', healthRouter);
app.use(
  '/api/v1/items',
  apiLimiter,
  createItemsRouter({ pool, logger })
);
app.get('/metrics', async (req, res, next) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    next(err);
  }
});
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl
  });
});
app.use(errorHandler);

export default app;