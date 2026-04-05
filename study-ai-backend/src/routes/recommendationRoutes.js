const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');

router.get('/daily-stats', recommendationController.getDailyStats);
router.get('/weak-subjects', recommendationController.weakSubjects);
router.get('/next-up', recommendationController.nextUp);

module.exports = router;
