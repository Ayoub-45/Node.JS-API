import pino from 'pino';
import pinoHttp from 'pino-http';
import crypto from 'crypto';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  base: {
    service: 'reliability-api'
  },

  timestamp: pino.stdTimeFunctions.isoTime
});

const requestLogger = pinoHttp({
  logger,

  genReqId: (req, res) => {
    const incomingId = req.headers['x-request-id'];

    const requestId =
      typeof incomingId === 'string' && incomingId.length > 0
        ? incomingId
        : crypto.randomUUID();

    res.setHeader('X-Request-ID', requestId);

    return requestId;
  },

  customLogLevel: (req, res, error) => {
    if (error || res.statusCode >= 500) {
      return 'error';
    }

    if (res.statusCode >= 400) {
      return 'warn';
    }

    return 'info';
  },

  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} completed`,

  customErrorMesinfosage: (req, res, error) =>
    `${req.method} ${req.url} failed`,

  customProps: (req) => ({
    requestId: req.id,
    method: req.method,
    path: req.url,
    userAgent: req.headers['user-agent']
  })
});

export { logger, requestLogger };