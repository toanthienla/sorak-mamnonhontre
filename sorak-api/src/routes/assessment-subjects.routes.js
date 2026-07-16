import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  createAssessmentSubjectSchema,
  listAssessmentSubjectQuery,
  updateAssessmentSubjectSchema,
  updateAssessmentSubjectStatusSchema,
} from '../validators/assessment-subjects.schema.js';
import * as ctrl from '../controllers/assessment-subjects.controller.js';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(listAssessmentSubjectQuery, 'query'),
  asyncHandler(ctrl.findAll),
);
router.get('/:id', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.findOne));
router.post(
  '/',
  requireRoles('PRINCIPAL'),
  validate(createAssessmentSubjectSchema),
  asyncHandler(ctrl.create),
);
router.patch(
  '/:id',
  requireRoles('PRINCIPAL'),
  validate(updateAssessmentSubjectSchema),
  asyncHandler(ctrl.update),
);
router.patch(
  '/:id/status',
  requireRoles('PRINCIPAL'),
  validate(updateAssessmentSubjectStatusSchema),
  asyncHandler(ctrl.setStatus),
);

export default router;
