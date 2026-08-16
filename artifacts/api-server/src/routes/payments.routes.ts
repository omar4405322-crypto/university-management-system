import express from 'express';
const router = express.Router();
import * as paymentsController from '../controllers/payments.controller';
import { authorize } from '../middleware/auth.middleware';
import { paymentValidation, functionalIdValidation } from '../validations/functional.validation';
import validate from '../middleware/validate.middleware';

router.get('/', authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), paymentsController.getAllPayments);
router.get('/my', authorize('STUDENT'), paymentsController.getMyPayments);
router.get('/stats', authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), paymentsController.getStats);
router.get(
  '/:id/receipt',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'STUDENT'),
  functionalIdValidation,
  validate,
  paymentsController.getPaymentReceipt
);
router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'), functionalIdValidation, validate, paymentsController.getPaymentById);


router.post(
  '/',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  paymentValidation,
  validate,
  paymentsController.createPayment
);
router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  [...functionalIdValidation, ...paymentValidation],
  validate,
  paymentsController.updatePayment
);
router.put(
  '/:id/pay',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  functionalIdValidation,
  validate,
  paymentsController.markAsPaid
);
router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'ADMIN', 'COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'),
  functionalIdValidation,
  validate,
  paymentsController.deletePayment
);

export default router;
