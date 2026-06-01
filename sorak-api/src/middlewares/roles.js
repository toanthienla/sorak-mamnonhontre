import { Forbidden } from '../utils/http-error.js';

// Usage: router.post('/', authMiddleware, requireRoles('BGH'), handler)
export const requireRoles = (...allowed) => (req, res, next) => {
  const role = req.user?.role;
  if (!role || !allowed.includes(role)) {
    return next(Forbidden(`Required role: ${allowed.join(' | ')}`));
  }
  next();
};
