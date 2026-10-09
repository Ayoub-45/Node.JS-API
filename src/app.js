import express from 'express';
import pinoHttp from 'pino-http';
import healthRouter from './routes/health.js';
import itemsRouter from './routes/items.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import {
  register,
  httpMetricsMiddleware,
} from './observability/metrics.js';
const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.use(
    pinoHttp({
        level: 'info'
    })
);
app.use(requestLogger)
app.use(httpMetricsMiddleware);
app.use('/health', healthRouter);
app.use('/api/v1/items', itemsRouter);

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