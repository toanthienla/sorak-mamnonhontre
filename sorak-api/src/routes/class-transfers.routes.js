import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  createClassTransferSchema,
  updateClassTransferStatusSchema,
  queryClassTransferSchema,
} from '../validators/class-transfers.schema.js';
import * as ctrl from '../controllers/class-transfers.controller.js';

const router = Router();
router.use(authMiddleware, requireRoles('PRINCIPAL', 'TEACHER'));

router.post('/', validate(createClassTransferSchema), asyncHandler(ctrl.create));
router.get('/', validate(queryClassTransferSchema, 'query'), asyncHandler(ctrl.findAll));
router.get('/:id', asyncHandler(ctrl.findOne));

export default router;
