export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const BadRequest = (msg, details) => new HttpError(400, 'VALIDATION_ERROR', msg, details);
export const Unauthorized = (msg = 'Unauthorized') => new HttpError(401, 'UNAUTHORIZED', msg);
export const Forbidden = (msg = 'Forbidden') => new HttpError(403, 'FORBIDDEN', msg);
export const NotFound = (msg = 'Not found') => new HttpError(404, 'NOT_FOUND', msg);
export const Conflict = (msg, details) => new HttpError(409, 'CONFLICT', msg, details);
