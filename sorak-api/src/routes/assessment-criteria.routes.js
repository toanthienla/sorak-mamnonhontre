import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  createAssessmentCriterionSchema,
  listAssessmentCriterionQuery,
  updateAssessmentCriterionSchema,
  updateAssessmentCriterionStatusSchema,
} from '../validators/assessment-criteria.schema.js';
import * as ctrl from '../controllers/assessment-criteria.controller.js';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(listAssessmentCriterionQuery, 'query'),
  asyncHandler(ctrl.findAll),
);
router.get('/:id/usages', requireRoles('PRINCIPAL'), asyncHandler(ctrl.findUsages));
router.get('/:id', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.findOne));
router.post(
  '/',
  requireRoles('PRINCIPAL'),
  validate(createAssessmentCriterionSchema),
  asyncHandler(ctrl.create),
);
router.patch(
  '/:id',
  requireRoles('PRINCIPAL'),
  validate(updateAssessmentCriterionSchema),
  asyncHandler(ctrl.update),
);
router.patch(
  '/:id/status',
  requireRoles('PRINCIPAL'),
  validate(updateAssessmentCriterionStatusSchema),
  asyncHandler(ctrl.setStatus),
);
router.delete('/:id', requireRoles('PRINCIPAL'), asyncHandler(ctrl.remove));

export default router;
