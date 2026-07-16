import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

export const listAssessmentSubjectQuery = paginationSchema.keys({
  assessment_age_group_id: Joi.number().integer().positive().optional(),
  development_field_id: Joi.number().integer().positive().optional(),
  is_active: Joi.string().valid('true', 'false').optional(),
});

export const createAssessmentSubjectSchema = Joi.object({
  assessment_age_group_id: Joi.number().integer().positive().required(),
  development_field_id: Joi.number().integer().positive().required(),
  name: Joi.string().trim().max(150).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
});

export const updateAssessmentSubjectSchema = Joi.object({
  name: Joi.string().trim().max(150).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
}).min(1);

export const updateAssessmentSubjectStatusSchema = Joi.object({
  is_active: Joi.boolean().required(),
});
