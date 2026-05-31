import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Unauthorized } from '../utils/http-error.js';

const ACCESS_COOKIE = 'sorak_access';

// Read accessToken from httpOnly cookie → attach req.user = { sub, role }
export function authMiddleware(req, res, next) {
  // Support both cookie (primary) and Bearer header (fallback for Swagger/tools)
  const token =
    req.cookies?.[ACCESS_COOKIE] ||
    req.headers.authorization?.replace('Bearer ', '').trim();

  if (!token) {
    return next(Unauthorized('Missing access token'));
  }
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret);
    req.user = { sub: payload.sub, role: payload.role };
    next();
  } catch {
    next(Unauthorized('Invalid or expired token'));
  }
}
