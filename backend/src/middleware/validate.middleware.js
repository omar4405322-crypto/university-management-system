const { validationResult } = require('express-validator');

/**
 * Centralized validation middleware to handle express-validator results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

  const firstMessage = errors.array()[0]?.msg || 'Validation failed';

  return res.status(422).json({
    success: false,
    message: firstMessage,
    errors: extractedErrors,
  });
};

module.exports = validate;
