import { randomUUID } from 'node:crypto';

export function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID();
  req.traceId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
