import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/http-error.js';
import logger from '../utils/logger.js';

const statusToCode = (status) => {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return 'INTERNAL_ERROR';
  }
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details;

  if (err instanceof HttpError) {
    status = err.status;
    code = err.code || statusToCode(status);
    message = err.message;
    details = err.details;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      code = 'DUPLICATE_KEY';
      message = 'Resource already exists';
      details = err.meta;
    } else if (err.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'Resource not found';
    } else {
      status = 400;
      code = 'DB_ERROR';
      message = err.message;
    }
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (status >= 500) {
    logger.error(
      { err, traceId: req.traceId, method: req.method, url: req.url },
      'Unhandled error',
    );
  }

  res.status(status).json({
    success: false,
    code,
    message,
    details,
    traceId: req.traceId,
    timestamp: new Date().toISOString(),
    path: req.url,
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.url} not found`,
    traceId: req.traceId,
    timestamp: new Date().toISOString(),
    path: req.url,
  });
}
