import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

const weekPatterns = ['ALL', 'ODD', 'EVEN'];
const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const sessions = ['MORNING', 'AFTERNOON'];
const activityTypes = ['SUBJECT', 'THEME_ACTIVITY'];

const activityTypeSchema = Joi.string()
  .custom((value, helpers) => {
    if (value === 'ROUTINE') {
      return helpers.message('Hoạt động sinh hoạt không thuộc phạm vi thời khóa biểu đánh giá.');
    }
    if (!activityTypes.includes(value)) {
      return helpers.error('any.only');
    }
    return value;
  })
  .required()
  .messages({ 'any.only': 'Loại hoạt động không hợp lệ.' });

const timetableItemSchema = Joi.object({
  weekPattern: Joi.string()
    .valid(...weekPatterns)
    .required(),
  dayOfWeek: Joi.string()
    .valid(...daysOfWeek)
    .required(),
  session: Joi.string()
    .valid(...sessions)
    .required(),
  displayOrder: Joi.number().integer().min(1).required(),
  activityType: activityTypeSchema,
  subjectId: Joi.number().integer().positive().allow(null).optional(),
  activityName: Joi.string().trim().max(150).allow('', null).optional(),
  isThemeBased: Joi.boolean().optional(),
  isAssessable: Joi.boolean().optional(),
  requiresWeeklyMapping: Joi.boolean().optional(),
  note: Joi.string().trim().max(500).allow('', null).optional(),
});

export const listAcademicYearTimetableQuery = paginationSchema.keys({
  academicYearId: Joi.number().integer().positive().optional(),
  ageGroupId: Joi.number().integer().positive().optional(),
  status: Joi.string().valid('DRAFT', 'LOCKED').optional(),
  keyword: Joi.string().trim().optional(),
});

export const createAcademicYearTimetableSchema = Joi.object({
  academicYearId: Joi.number().integer().positive().required(),
  ageGroupId: Joi.number().integer().positive().required(),
  name: Joi.string().trim().max(150).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  items: Joi.array().items(timetableItemSchema).min(0).required(),
});

export const updateAcademicYearTimetableSchema = Joi.object({
  academicYearId: Joi.number().integer().positive().optional(),
  ageGroupId: Joi.number().integer().positive().optional(),
  name: Joi.string().trim().max(150).optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  changeReason: Joi.string().trim().max(1000).required(),
  items: Joi.array().items(timetableItemSchema).min(0).required(),
}).min(2);

export const unlockAcademicYearTimetableSchema = Joi.object({
  unlockReason: Joi.string().trim().max(1000).required(),
});

export const assignedWeeklyTimetableQuery = Joi.object({
  academicYearId: Joi.number().integer().positive().optional(),
});

export const assignedDailyActivitiesQuery = Joi.object({
  date: Joi.date().iso().optional(),
  dayOfWeek: Joi.string()
    .valid(...daysOfWeek)
    .optional(),
  academicYearId: Joi.number().integer().positive().optional(),
  weekNumber: Joi.number().integer().min(1).max(5).optional(),
  weekPattern: Joi.string()
    .valid(...weekPatterns)
    .optional(),
}).or('date', 'dayOfWeek');
