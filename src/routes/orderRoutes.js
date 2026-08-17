const express = require('express');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.post('/upload-orders', (req, res, next) => orderController.uploadOrders(req, res, next));
router.get('/orders/:orderId', (req, res, next) => orderController.getOrderById(req, res, next));
router.get('/orders', (req, res, next) => orderController.getOrders(req, res, next));

module.exports = router;
