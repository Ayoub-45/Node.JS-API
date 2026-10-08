import crypto from 'node:crypto';

export function requestLogger(req, res, next) {
  const requestId =
    req.headers['x-request-id'] || crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs =
      Number(process.hrtime.bigint() - start) / 1_000_000;

    req.log.info({
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2))
    });
  });

  next();
}