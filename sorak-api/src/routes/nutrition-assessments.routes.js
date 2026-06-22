import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import { uploadXlsx } from '../middlewares/upload.js';
import {
  nutritionGridQuerySchema,
  nutritionGridAllQuerySchema,
  nutritionBulkSchema,
} from '../validators/health.schema.js';
import * as ctrl from '../controllers/nutrition-assessments.controller.js';

const router = Router();
router.use(authMiddleware, requireRoles('PRINCIPAL', 'TEACHER'));

router.get('/grid', validate(nutritionGridQuerySchema, 'query'), asyncHandler(ctrl.grid));
router.get('/grid-all', validate(nutritionGridAllQuerySchema, 'query'), asyncHandler(ctrl.gridAll));

export default router;
