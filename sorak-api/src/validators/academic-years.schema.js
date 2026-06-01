import Joi from 'joi';

export const createAcademicYearSchema = Joi.object({
  name: Joi.string()
    .max(20)
    .pattern(/^\d{4}-\d{4}$/)
    .required()
    .messages({ 'string.pattern.base': 'name phải dạng YYYY-YYYY' }),
  start_date: Joi.string().isoDate().required(),
  end_date: Joi.string().isoDate().required(),
});

export const updateAcademicYearSchema = Joi.object({
  name: Joi.string().max(20).pattern(/^\d{4}-\d{4}$/).optional(),
  start_date: Joi.string().isoDate().optional(),
  end_date: Joi.string().isoDate().optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
}).min(1);

export const listAcademicYearQuery = Joi.object({});
