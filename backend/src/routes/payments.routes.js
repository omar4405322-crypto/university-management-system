const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const roleMiddleware = require('../middleware/role.middleware');

router.get('/', roleMiddleware(['ADMIN']), paymentsController.getAllPayments);
router.get('/my', roleMiddleware(['STUDENT']), paymentsController.getMyPayments);
router.get('/stats', roleMiddleware(['ADMIN']), paymentsController.getStats);
router.get('/:id', paymentsController.getPaymentById);

router.post('/', roleMiddleware(['ADMIN']), paymentsController.createPayment);
router.put('/:id', roleMiddleware(['ADMIN']), paymentsController.updatePayment);
router.put('/:id/pay', roleMiddleware(['ADMIN']), paymentsController.markAsPaid);
router.delete('/:id', roleMiddleware(['ADMIN']), paymentsController.deletePayment);

module.exports = router;
