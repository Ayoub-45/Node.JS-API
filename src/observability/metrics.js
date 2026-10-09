
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

const register = new Registry();

register.setDefaultLabels({
  service: 'reliability-api',
});

// Node.js runtime metrics: memory, event loop, CPU, and more.
collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of completed HTTP requests.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

function httpMetricsMiddleware(req, res, next) {
  // Keep health checks and the metrics endpoint out of HTTP traffic metrics.
  if (
    req.path === '/metrics' ||
    req.path === '/health' ||
    req.path.startsWith('/health/')
  ) {
    return next();
  }

  const start = process.hrtime.bigint();

  res.once('finish', () => {
    // Use Express route templates, not raw URLs or IDs.
    const route = req.route
      ? `${req.baseUrl || ''}${req.route.path}`
      : 'unmatched';

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    const durationSeconds =
      Number(process.hrtime.bigint() - start) / 1e9;

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
  });

  next();
}

export { register, httpMetricsMiddleware };