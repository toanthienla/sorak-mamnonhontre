import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import { listDevelopmentFieldQuery } from '../validators/development-fields.schema.js';
import * as ctrl from '../controllers/development-fields.controller.js';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(listDevelopmentFieldQuery, 'query'),
  asyncHandler(ctrl.findAll),
);

export default router;
