import Joi from 'joi';
import { paginationSchema } from './common.schema.js';

const requestTypes = ['SUBJECT', 'THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'];
const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

const criterionProposalSchema = Joi.object({
  content: Joi.string().trim().max(1000).optional(),
  description: Joi.string().trim().max(1000).allow('', null).optional(),
  age_group_id: Joi.number().integer().positive().optional(),
  ageGroupId: Joi.number().integer().positive().optional(),
  development_field_id: Joi.number().integer().positive().optional(),
  developmentFieldId: Joi.number().integer().positive().optional(),
  subject_id: Joi.number().integer().positive().optional(),
  subjectId: Joi.number().integer().positive().optional(),
  theme_id: Joi.number().integer().positive().optional(),
  themeId: Joi.number().integer().positive().optional(),
})
  .or('content', 'description')
  .unknown(false);

export const listAssessmentContentRequestQuery = paginationSchema.keys({
  request_type: Joi.string()
    .valid(...requestTypes)
    .optional(),
  status: Joi.string()
    .valid(...statuses)
    .optional(),
  requester_teacher_id: Joi.number().integer().positive().optional(),
  requester_class_id: Joi.number().integer().positive().optional(),
  age_group_id: Joi.number().integer().positive().optional(),
  development_field_id: Joi.number().integer().positive().optional(),
  subject_id: Joi.number().integer().positive().optional(),
  theme_id: Joi.number().integer().positive().optional(),
  topic_id: Joi.number().integer().positive().optional(),
  created_from: Joi.date().iso().optional(),
  created_to: Joi.date().iso().optional(),
});

export const createAssessmentContentRequestSchema = Joi.object({
  request_type: Joi.string()
    .valid(...requestTypes)
    .required(),
  proposed_name: Joi.when('request_type', {
    is: Joi.valid('SUBJECT', 'THEME', 'TOPIC', 'TOPIC_WITH_CRITERIA'),
    then: Joi.string().trim().max(150).required(),
    otherwise: Joi.string().trim().max(1000).required(),
  }),
  proposed_description: Joi.string().trim().max(500).allow('', null).optional(),
  proposed_reason: Joi.string().trim().max(1000).required(),
  proposed_criteria: Joi.when('request_type', {
    is: 'TOPIC_WITH_CRITERIA',
    then: Joi.array().items(criterionProposalSchema).min(1).required(),
    otherwise: Joi.array().items(criterionProposalSchema).optional(),
  }),
  age_group_id: Joi.when('request_type', {
    is: Joi.valid('SUBJECT', 'THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'),
    then: Joi.number().integer().positive().required(),
    otherwise: Joi.number().integer().positive().optional(),
  }),
  development_field_id: Joi.when('request_type', {
    is: Joi.valid('SUBJECT', 'THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'),
    then: Joi.number().integer().positive().required(),
    otherwise: Joi.number().integer().positive().optional(),
  }),
  subject_id: Joi.when('request_type', {
    is: Joi.valid('THEME', 'TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'),
    then: Joi.number().integer().positive().required(),
    otherwise: Joi.number().integer().positive().optional(),
  }),
  theme_id: Joi.when('request_type', {
    is: Joi.valid('TOPIC', 'CRITERION', 'TOPIC_WITH_CRITERIA'),
    then: Joi.number().integer().positive().required(),
    otherwise: Joi.number().integer().positive().optional(),
  }),
  topic_id: Joi.when('request_type', {
    is: 'CRITERION',
    then: Joi.number().integer().positive().required(),
    otherwise: Joi.number().integer().positive().optional(),
  }),
  requester_class_id: Joi.number().integer().positive().allow(null).optional(),
});

export const reviewAssessmentContentRequestSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  review_note: Joi.when('action', {
    is: 'reject',
    then: Joi.string().trim().max(1000).required(),
    otherwise: Joi.string().trim().max(1000).allow('', null).optional(),
  }),
});
