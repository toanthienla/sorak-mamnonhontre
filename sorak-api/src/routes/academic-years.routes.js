import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
  listAcademicYearQuery,
} from '../validators/academic-years.schema.js';
import * as ctrl from '../controllers/academic-years.controller.js';

const router = Router();
router.use(authMiddleware);

router.post(
  '/',
  requireRoles('PRINCIPAL'),
  validate(createAcademicYearSchema),
  asyncHandler(ctrl.create),
);
router.get(
  '/',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(listAcademicYearQuery, 'query'),
  asyncHandler(ctrl.findAll),
);
router.get('/archived', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.findArchived));
router.get('/:id', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.findOne));
router.patch(
  '/:id',
  requireRoles('PRINCIPAL'),
  validate(updateAcademicYearSchema),
  asyncHandler(ctrl.update),
);
router.patch('/:id/activate', requireRoles('PRINCIPAL'), asyncHandler(ctrl.setActive));
router.post('/:id/promote', requireRoles('PRINCIPAL'), asyncHandler(ctrl.promote));
router.delete('/:id', requireRoles('PRINCIPAL'), asyncHandler(ctrl.softDelete));
router.post('/:id/restore', requireRoles('PRINCIPAL'), asyncHandler(ctrl.restore));

export default router;
