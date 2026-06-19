import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

// ─── Outgoing ────────────────────────────────────────────────────────────────

export const createOutgoingSchema = Joi.object({
  student_id: Joi.number().integer().positive().required(),
  school_year_id: Joi.number().integer().positive().optional(),
  destination_school: Joi.string().trim().max(255).required(),
  transfer_date: Joi.string().isoDate().required(),
  reason: Joi.string().trim().max(500).allow(null, '').optional(),
  note: Joi.string().trim().max(500).allow(null, '').optional(),
});

export const updateOutgoingSchema = Joi.object({
  destination_school: Joi.string().trim().max(255).optional(),
  transfer_date: Joi.string().isoDate().optional(),
  reason: Joi.string().trim().max(500).allow(null, '').optional(),
  note: Joi.string().trim().max(500).allow(null, '').optional(),
}).min(1);

// ─── Incoming ────────────────────────────────────────────────────────────────

export const createIncomingSchema = Joi.object({
  student_id: Joi.number().integer().positive().required(),
  school_year_id: Joi.number().integer().positive().optional(),
  previous_school: Joi.string().trim().max(255).required(),
  transfer_date: Joi.string().isoDate().required(),
  reason: Joi.string().trim().max(500).allow(null, '').optional(),
  note: Joi.string().trim().max(500).allow(null, '').optional(),
});

export const updateIncomingSchema = Joi.object({
  previous_school: Joi.string().trim().max(255).optional(),
  transfer_date: Joi.string().isoDate().optional(),
  reason: Joi.string().trim().max(500).allow(null, '').optional(),
  note: Joi.string().trim().max(500).allow(null, '').optional(),
}).min(1);

// ─── Shared ──────────────────────────────────────────────────────────────────

export const cancelTransferSchema = Joi.object({
  cancel_reason: Joi.string().trim().max(500).allow(null, '').optional(),
});

export const querySchoolTransferSchema = paginationSchema.keys({
  status: Joi.string().valid('Recorded', 'Cancelled').optional(),
  school_year_id: Joi.number().integer().positive().optional(),
  class_id: Joi.number().integer().positive().optional(),
  student_id: Joi.number().integer().positive().optional(),
  previous_school: Joi.string().trim().optional(),
});
