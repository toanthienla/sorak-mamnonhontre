import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import { uploadXlsx } from '../middlewares/upload.js';
import {
  createTeacherSchema,
  updateTeacherSchema,
  queryTeacherSchema,
} from '../validators/teachers.schema.js';
import * as ctrl from '../controllers/teachers.controller.js';

const router = Router();
router.use(authMiddleware);

router.post(
  '/',
  requireRoles('PRINCIPAL'),
  validate(createTeacherSchema),
  asyncHandler(ctrl.create),
);
router.get(
  '/',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(queryTeacherSchema, 'query'),
  asyncHandler(ctrl.findAll),
);
router.get('/archived', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.findArchived));
router.get('/export/excel', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.exportExcel));
router.get('/:id', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.findOne));
router.patch(
  '/:id',
  requireRoles('PRINCIPAL'),
  validate(updateTeacherSchema),
  asyncHandler(ctrl.update),
);
router.patch('/:id/restore', requireRoles('PRINCIPAL'), asyncHandler(ctrl.restore));
router.delete('/:id', requireRoles('PRINCIPAL'), asyncHandler(ctrl.softDelete));
router.get('/import/template', requireRoles('PRINCIPAL'), asyncHandler(ctrl.importTemplate));
router.post(
  '/import/preview',
  requireRoles('PRINCIPAL'),
  uploadXlsx.single('file'),
  asyncHandler(ctrl.previewImport),
);
router.post(
  '/import',
  requireRoles('PRINCIPAL'),
  uploadXlsx.single('file'),
  asyncHandler(ctrl.importExcel),
);

export default router;
