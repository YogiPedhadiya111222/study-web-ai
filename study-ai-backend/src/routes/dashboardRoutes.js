const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/', dashboardController.getDashboard);
router.get('/streak', dashboardController.getStreak);
router.get('/productivity', dashboardController.getProductivity);
router.get('/productivity/weekly', dashboardController.getWeeklyProductivity);

module.exports = router;
