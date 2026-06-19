import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  createOutgoingSchema,
  updateOutgoingSchema,
  cancelTransferSchema,
  querySchoolTransferSchema,
} from '../validators/school-transfers.schema.js';
import * as ctrl from '../controllers/outgoing-transfers.controller.js';

const router = Router();
router.use(authMiddleware, requireRoles('PRINCIPAL', 'TEACHER'));

// View + export: PRINCIPAL + TEACHER

router.get('/', validate(querySchoolTransferSchema, 'query'), asyncHandler(ctrl.findAll));
router.get('/:id', asyncHandler(ctrl.findOne));

// Mutations: PRINCIPAL only (UC-50, UC-53, UC-54)
router.post(
  '/',
  requireRoles('PRINCIPAL'),
  validate(createOutgoingSchema),
  asyncHandler(ctrl.create),
);
router.patch(
  '/:id',
  requireRoles('PRINCIPAL'),
  validate(updateOutgoingSchema),
  asyncHandler(ctrl.update),
);
router.patch(
  '/:id/cancel',
  requireRoles('PRINCIPAL'),
  validate(cancelTransferSchema),
  asyncHandler(ctrl.cancel),
);

export default router;
