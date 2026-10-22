import { body, param, query } from 'express-validator';

export const MAX_POINTS_TECHNICAL_CEILING = 10000;

export const gradeStructureGetValidation = [
  param('courseId')
    .notEmpty()
    .withMessage('Course ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid course ID format'),
  query('termId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid term ID format'),
];

export const gradeStructurePutValidation = [
  param('courseId')
    .notEmpty()
    .withMessage('Course ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid course ID format'),
  query('termId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid term ID format'),
  body('components')
    .isArray({ min: 1 })
    .withMessage('Components must be a non-empty array with at least one component')
    .custom((components: any[]) => {
      if (!Array.isArray(components) || components.length === 0) {
        throw new Error('Components must be a non-empty array');
      }

      const seenNames = new Set<string>();
      let autoQuizCount = 0;
      let autoAttendanceCount = 0;

      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        if (!comp || typeof comp !== 'object') {
          throw new Error(`Component at index ${i} must be an object`);
        }

        // Validate name
        if (typeof comp.name !== 'string' || comp.name.trim().length === 0) {
          throw new Error(`Component at index ${i} must have a non-empty name`);
        }
        const trimmedName = comp.name.trim();
        if (trimmedName.length > 100) {
          throw new Error(`Component name at index ${i} exceeds 100 characters`);
        }
        if (/[\x00-\x1F\x7F]/.test(trimmedName)) {
          throw new Error(`Component "${trimmedName}" contains forbidden control characters`);
        }
        if (/[<>]/.test(trimmedName)) {
          throw new Error(`Component "${trimmedName}" cannot contain angle brackets (< or >)`);
        }

        // Case-insensitive uniqueness
        const lowerName = trimmedName.toLowerCase();
        if (seenNames.has(lowerName)) {
          throw new Error(`Duplicate component name: "${trimmedName}". Names must be unique within course`);
        }
        seenNames.add(lowerName);

        // Optional nameAr
        if (comp.nameAr !== undefined && comp.nameAr !== null) {
          if (typeof comp.nameAr !== 'string' || comp.nameAr.length > 100) {
            throw new Error(`Arabic component name at index ${i} must be a string up to 100 characters`);
          }
        }

        // Validate maxPoints
        const points = Number(comp.maxPoints);
        if (
          comp.maxPoints === undefined ||
          comp.maxPoints === null ||
          typeof comp.maxPoints !== 'number' ||
          !Number.isFinite(points) ||
          points <= 0
        ) {
          throw new Error(`Component "${trimmedName}" maxPoints must be a strictly positive finite number`);
        }
        if (points > MAX_POINTS_TECHNICAL_CEILING) {
          throw new Error(
            `Component "${trimmedName}" maxPoints exceeds technical ceiling of ${MAX_POINTS_TECHNICAL_CEILING}`
          );
        }
        // Up to 2 decimal places
        if (Math.round(points * 100) !== points * 100) {
          throw new Error(`Component "${trimmedName}" maxPoints can have at most 2 decimal places`);
        }

        // Validate source
        if (!['AUTO_QUIZ', 'AUTO_ATTENDANCE', 'MANUAL'].includes(comp.source)) {
          throw new Error(
            `Component "${trimmedName}" source must be one of AUTO_QUIZ, AUTO_ATTENDANCE, or MANUAL`
          );
        }
        if (comp.source === 'AUTO_QUIZ') autoQuizCount++;
        if (comp.source === 'AUTO_ATTENDANCE') autoAttendanceCount++;

        // Validate optional displayOrder
        if (comp.displayOrder !== undefined && comp.displayOrder !== null) {
          if (!Number.isInteger(comp.displayOrder) || comp.displayOrder < 1) {
            throw new Error(`Component "${trimmedName}" displayOrder must be a positive integer`);
          }
        }

        // Validate optional id
        if (comp.id !== undefined && comp.id !== null) {
          if (!Number.isInteger(comp.id) || comp.id < 1) {
            throw new Error(`Component "${trimmedName}" id must be a positive integer`);
          }
        }
      }

      if (autoQuizCount > 1) {
        throw new Error('At most one component with source AUTO_QUIZ is permitted per course');
      }
      if (autoAttendanceCount > 1) {
        throw new Error('At most one component with source AUTO_ATTENDANCE is permitted per course');
      }

      return true;
    }),

  body('passMark')
    .optional({ nullable: true })
    .custom((val, { req }) => {
      if (val === null || val === undefined || val === '') return true;
      const num = Number(val);
      if (typeof val !== 'number' || !Number.isFinite(num) || num <= 0) {
        throw new Error('passMark must be a positive finite number or null');
      }
      if (Math.round(num * 100) !== num * 100) {
        throw new Error('passMark can have at most 2 decimal places');
      }

      // Validate <= totalPoints (sum of components)
      const components = req.body.components;
      if (Array.isArray(components)) {
        const totalPoints = components.reduce(
          (sum: number, c: any) => sum + (typeof c?.maxPoints === 'number' && Number.isFinite(c.maxPoints) ? c.maxPoints : 0),
          0
        );
        if (num > totalPoints) {
          throw new Error(`passMark (${num}) cannot exceed total course points (${totalPoints})`);
        }
      }
      return true;
    }),
];
