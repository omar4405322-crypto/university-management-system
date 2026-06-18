import express from 'express';
const router = express.Router();
import * as paymentsController from '../controllers/payments.controller.js';
import { authorize } from '../middleware/auth.middleware.js';
import { paymentValidation, functionalIdValidation } from '../validations/functional.validation.js';
import validate from '../middleware/validate.middleware.js';

router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), paymentsController.getAllPayments);
router.get('/my', authorize('STUDENT'), paymentsController.getMyPayments);
router.get('/stats', authorize('SUPER_ADMIN', 'ADMIN'), paymentsController.getStats);
router.get('/:id', functionalIdValidation, validate, paymentsController.getPaymentById);

router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), paymentValidation, validate, paymentsController.createPayment);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), [...functionalIdValidation, ...paymentValidation], validate, paymentsController.updatePayment);
router.put('/:id/pay', authorize('SUPER_ADMIN', 'ADMIN'), functionalIdValidation, validate, paymentsController.markAsPaid);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), functionalIdValidation, validate, paymentsController.deletePayment);

export default router;
