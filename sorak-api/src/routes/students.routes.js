import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import { uploadXlsx, uploadPhoto } from '../middlewares/upload.js';
import {
  createStudentSchema,
  updateStudentSchema,
  queryStudentSchema,
  parentInputSchema,
  batchParentsSchema,
} from '../validators/students.schema.js';
import * as ctrl from '../controllers/students.controller.js';

const router = Router();
router.use(authMiddleware);

router.post(
  '/',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(createStudentSchema),
  asyncHandler(ctrl.create),
);
router.get(
  '/',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(queryStudentSchema, 'query'),
  asyncHandler(ctrl.findAll),
);
router.get('/archived', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.findArchived));
router.get('/export/excel', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.exportExcel));
router.get('/:id', requireRoles('PRINCIPAL', 'TEACHER'), asyncHandler(ctrl.findOne));
router.patch(
  '/:id',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(updateStudentSchema),
  asyncHandler(ctrl.update),
);
router.patch('/:id/restore', requireRoles('PRINCIPAL'), asyncHandler(ctrl.restore));
router.delete('/:id', requireRoles('PRINCIPAL'), asyncHandler(ctrl.softDelete));
router.post(
  '/:id/parents',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(parentInputSchema),
  asyncHandler(ctrl.addParent),
);
router.patch(
  '/:id/parents',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(batchParentsSchema),
  asyncHandler(ctrl.batchUpdateParents),
);
router.patch(
  '/parents/:parentId',
  requireRoles('PRINCIPAL', 'TEACHER'),
  validate(parentInputSchema),
  asyncHandler(ctrl.updateParent),
);
router.post(
  '/:id/reset-password',
  requireRoles('PRINCIPAL', 'TEACHER'),
  asyncHandler(ctrl.resetPassword),
);
router.patch('/:id/active', requireRoles('PRINCIPAL'), asyncHandler(ctrl.setActive));
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
router.post(
  '/:id/photo',
  requireRoles('PRINCIPAL', 'TEACHER'),
  uploadPhoto,
  asyncHandler(ctrl.uploadPhoto),
);

export default router;
