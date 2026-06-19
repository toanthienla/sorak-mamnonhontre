import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

export const createClassTransferSchema = Joi.object({
  student_id: Joi.number().integer().positive().required(),
  to_class_id: Joi.number().integer().positive().required(),
  reason: Joi.string().trim().max(500).required(),
  effective_date: Joi.string().isoDate().required(),
});

export const updateClassTransferStatusSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'cancel', 'revert').required(),
  note: Joi.string().trim().max(500).allow(null, '').optional(),
});

export const queryClassTransferSchema = paginationSchema.keys({
  status: Joi.string().valid('Pending', 'Approved', 'Rejected', 'Cancelled', 'Expired').optional(),
  school_year_id: Joi.number().integer().positive().optional(),
  class_id: Joi.number().integer().positive().optional(),
  student_id: Joi.number().integer().positive().optional(),
});
