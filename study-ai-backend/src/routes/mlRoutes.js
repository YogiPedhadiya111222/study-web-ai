const express = require('express');
const router = express.Router();
const mlController = require('../controllers/mlController');

router.get('/optimal-times', mlController.getOptimalTimes);
router.get('/schedule', mlController.getPersonalizedSchedule);

module.exports = router;