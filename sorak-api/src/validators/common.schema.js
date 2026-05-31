import Joi from 'joi';

export const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(500).default(20),
  search: Joi.string().trim().allow('').optional(),
  sortBy: Joi.string().trim().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});
