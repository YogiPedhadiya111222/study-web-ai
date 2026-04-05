const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

router.post('/', testController.createTest);
router.get('/', testController.getTests);
router.get('/:id', testController.getTestById);
router.get('/task/:taskId', testController.getTestsByTask);

module.exports = router;
