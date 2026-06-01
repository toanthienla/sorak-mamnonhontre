import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { validate } from '../middlewares/validate.js';
import { authMiddleware } from '../middlewares/auth.js';
import { requireRoles } from '../middlewares/roles.js';
import {
  createAccountSchema,
  updateAccountSchema,
  changeRoleSchema,
  assignRoleSchema,
  setActiveSchema,
  queryAccountSchema,
} from '../validators/accounts.schema.js';
import * as ctrl from '../controllers/accounts.controller.js';

const router = Router();
router.use(authMiddleware, requireRoles('BGH'));

router.post('/', validate(createAccountSchema), asyncHandler(ctrl.create));
router.get('/', validate(queryAccountSchema, 'query'), asyncHandler(ctrl.findAll));
router.get('/export/excel', asyncHandler(ctrl.exportExcel));
router.get('/:id', asyncHandler(ctrl.findOne));
router.patch('/:id', validate(updateAccountSchema), asyncHandler(ctrl.update));
router.patch('/:id/role', validate(changeRoleSchema), asyncHandler(ctrl.changeRole));
router.post('/:id/assign-role', validate(assignRoleSchema), asyncHandler(ctrl.assignRole));
router.patch('/:id/active', validate(setActiveSchema), asyncHandler(ctrl.setActive));
router.delete('/:id', asyncHandler(ctrl.softDelete));
router.patch('/:id/restore', asyncHandler(ctrl.restore));

export default router;
