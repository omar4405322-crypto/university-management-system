const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const { authorize } = require('../middleware/auth.middleware');
const { paymentValidation, functionalIdValidation } = require('../validations/functional.validation');
const validate = require('../middleware/validate.middleware');

router.get('/', authorize('SUPER_ADMIN', 'ADMIN'), paymentsController.getAllPayments);
router.get('/my', authorize('STUDENT'), paymentsController.getMyPayments);
router.get('/stats', authorize('SUPER_ADMIN', 'ADMIN'), paymentsController.getStats);
router.get('/:id', functionalIdValidation, validate, paymentsController.getPaymentById);

router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), paymentValidation, validate, paymentsController.createPayment);
router.put('/:id', authorize('SUPER_ADMIN', 'ADMIN'), [...functionalIdValidation, ...paymentValidation], validate, paymentsController.updatePayment);
router.put('/:id/pay', authorize('SUPER_ADMIN', 'ADMIN'), functionalIdValidation, validate, paymentsController.markAsPaid);
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), functionalIdValidation, validate, paymentsController.deletePayment);

module.exports = router;
