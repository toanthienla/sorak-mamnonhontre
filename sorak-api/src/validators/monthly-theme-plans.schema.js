import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

export const listMonthlyThemePlanQuery = paginationSchema.keys({
  academicYearId: Joi.number().integer().positive().optional(),
  keyword: Joi.string().trim().allow('').optional(),
  status: Joi.string().valid('DRAFT', 'READY', 'USED').optional(),
  fromDate: Joi.date().iso().optional(),
  toDate: Joi.date().iso().optional(),
});

export const createMonthlyThemePlanSchema = Joi.object({
  academicYearId: Joi.number().integer().positive().optional(),
  name: Joi.string().trim().max(150).required(),
  planningYear: Joi.number().integer().min(2000).max(2100).required(),
  planningMonth: Joi.number().integer().min(1).max(12).required(),
  selectedWeeks: Joi.array().items(Joi.number().integer().min(1).max(6)).unique().min(1).required(),
  note: Joi.string().trim().max(500).allow('', null).optional(),
});

export const updateMonthlyThemePlanSchema = Joi.object({
  name: Joi.string().trim().max(150).optional(),
  planningYear: Joi.number().integer().min(2000).max(2100).optional(),
  planningMonth: Joi.number().integer().min(1).max(12).optional(),
  selectedWeeks: Joi.array().items(Joi.number().integer().min(1).max(6)).unique().min(1).optional(),
  note: Joi.string().trim().max(500).allow('', null).optional(),
}).min(1);

export const planningWeeksQuery = Joi.object({
  academicYearId: Joi.number().integer().positive().optional(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  month: Joi.number().integer().min(1).max(12).required(),
  exceptId: Joi.number().integer().positive().optional(),
});

export const criteriaBankQuery = Joi.object({
  keyword: Joi.string().trim().allow('').optional(),
  developmentFieldId: Joi.number().integer().positive().optional(),
  subjectId: Joi.number().integer().positive().optional(),
  themeId: Joi.number().integer().positive().optional(),
  selectedOnly: Joi.string().valid('true', 'false').optional(),
});

export const updateSelectedCriteriaSchema = Joi.object({
  criterionIds: Joi.array().items(Joi.number().integer().positive()).unique().required(),
});

export const completeMonthlyThemePlanSchema = Joi.object({
  confirmIncompleteFields: Joi.boolean().optional(),
});
