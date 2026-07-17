import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

export const listAssessmentCriterionQuery = paginationSchema.keys({
  assessment_age_group_id: Joi.number().integer().positive().optional(),
  development_field_id: Joi.number().integer().positive().optional(),
  assessment_subject_id: Joi.number().integer().positive().optional(),
  assessment_theme_id: Joi.number().integer().positive().optional(),
  assessment_topic_id: Joi.number().integer().positive().optional(),
  is_active: Joi.string().valid('true', 'false').optional(),
});

export const createAssessmentCriterionSchema = Joi.object({
  assessment_age_group_id: Joi.number().integer().positive().required(),
  development_field_id: Joi.number().integer().positive().required(),
  assessment_subject_id: Joi.number().integer().positive().required(),
  assessment_theme_id: Joi.number().integer().positive().required(),
  assessment_topic_id: Joi.number().integer().positive().required(),
  content: Joi.string().trim().max(1000).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
});

export const updateAssessmentCriterionSchema = Joi.object({
  content: Joi.string().trim().max(1000).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
}).min(1);

export const updateAssessmentCriterionStatusSchema = Joi.object({
  is_active: Joi.boolean().required(),
});
