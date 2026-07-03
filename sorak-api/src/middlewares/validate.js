import { BadRequest } from '../utils/http-error.js';

/**
 * Joi validation middleware.
 *   validate(schema)                → validates req.body
 *   validate(schema, 'query')       → validates req.query
 *   validate(schema, 'params')      → validates req.params
 * Replaces the source object with the coerced value so types are normalized.
 */
export const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const { value, error } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      return next(
        BadRequest(
          'Validation failed',
          error.details.map((d) => ({ path: d.path.join('.'), message: d.message })),
        ),
      );
    }
    req[source] = value;
    next();
  };
