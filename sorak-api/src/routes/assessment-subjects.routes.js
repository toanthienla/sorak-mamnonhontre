import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  createAssessmentThemeSchema,
  listAssessmentThemeQuery,
  updateAssessmentThemeSchema,
  updateAssessmentThemeStatusSchema,
} from '../validators/assessment-themes.schema.js';
import * as ctrl from '../controllers/assessment-themes.controller.js';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(listAssessmentThemeQuery, 'query'),
  asyncHandler(ctrl.findAll),
);
router.get('/:id', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.findOne));
router.post(
  '/',
  requireRoles('PRINCIPAL'),
  validate(createAssessmentThemeSchema),
  asyncHandler(ctrl.create),
);
router.patch(
  '/:id',
  requireRoles('PRINCIPAL'),
  validate(updateAssessmentThemeSchema),
  asyncHandler(ctrl.update),
);
router.patch(
  '/:id/status',
  requireRoles('PRINCIPAL'),
  validate(updateAssessmentThemeStatusSchema),
  asyncHandler(ctrl.setStatus),
);
router.delete('/:id', requireRoles('PRINCIPAL'), asyncHandler(ctrl.remove));

export default router;
