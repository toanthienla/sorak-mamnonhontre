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
router.get(
  '/export/excel',
  validate(nutritionGridQuerySchema, 'query'),
  asyncHandler(ctrl.exportExcel),
);
router.get('/import/template', asyncHandler(ctrl.importTemplate));
router.post('/import/preview', uploadXlsx.single('file'), asyncHandler(ctrl.previewImport));
router.post('/import', uploadXlsx.single('file'), asyncHandler(ctrl.importExcel));
router.post('/bulk', validate(nutritionBulkSchema), asyncHandler(ctrl.bulkUpsert));

export default router;
