import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middlewares/validate.js";
import { authMiddleware } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/roles.js";
import { uploadXlsx, uploadImage } from "../middlewares/upload.js";
import {
  createStudentSchema,
  updateStudentSchema,
  queryStudentSchema,
  parentInputSchema,
} from "../validators/students.schema.js";
import * as ctrl from "../controllers/students.controller.js";

const router = Router();
router.use(authMiddleware);

router.post(
  "/",
  requireRoles("BGH"),
  validate(createStudentSchema),
  asyncHandler(ctrl.create),
);
router.get(
  "/",
  requireRoles("BGH", "GV"),
  validate(queryStudentSchema, "query"),
  asyncHandler(ctrl.findAll),
);
router.get(
  "/archived",
  requireRoles("BGH", "GV"),
  asyncHandler(ctrl.findArchived),
);
router.get(
  "/export/excel",
  requireRoles("BGH", "GV"),
  asyncHandler(ctrl.exportExcel),
);
router.get("/:id", requireRoles("BGH", "GV"), asyncHandler(ctrl.findOne));
router.patch(
  "/:id",
  requireRoles("BGH"),
  validate(updateStudentSchema),
  asyncHandler(ctrl.update),
);
router.patch("/:id/restore", requireRoles("BGH"), asyncHandler(ctrl.restore));
router.delete("/:id", requireRoles("BGH"), asyncHandler(ctrl.softDelete));
router.post(
  "/:id/parents",
  requireRoles("BGH"),
  validate(parentInputSchema),
  asyncHandler(ctrl.addParent),
);
router.patch(
  "/parents/:parentId",
  requireRoles("BGH"),
  asyncHandler(ctrl.updateParent),
);
router.post(
  "/:id/reset-password",
  requireRoles("BGH", "GV"),
  asyncHandler(ctrl.resetPassword),
);
router.patch("/:id/active", requireRoles("BGH"), asyncHandler(ctrl.setActive));
router.post(
  "/import",
  requireRoles("BGH"),
  uploadXlsx.single("file"),
  asyncHandler(ctrl.importExcel),
);
router.post(
  "/:id/photo",
  requireRoles("BGH", "GV"),
  uploadImage.single("photo"),
  asyncHandler(ctrl.uploadPhoto),
);

export default router;
