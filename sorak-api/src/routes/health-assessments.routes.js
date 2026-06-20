import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import { uploadXlsx } from '../middlewares/upload.js';
import {
  createHealthSchema,
  updateHealthSchema,
  queryHealthSchema,
  historyQuerySchema,
  curvesQuerySchema,
  bulkHealthSchema,
  byClassDateSchema,
} from '../validators/health.schema.js';
import * as ctrl from '../controllers/health-assessments.controller.js';

const router = Router();
router.use(authMiddleware, requireRoles('PRINCIPAL', 'TEACHER'));

// Static routes BEFORE /:id

router.get('/', validate(queryHealthSchema, 'query'), asyncHandler(ctrl.findAll));
router.post('/', validate(createHealthSchema), asyncHandler(ctrl.create));

export default router;
