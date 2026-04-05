const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');

router.post('/', activityController.createActivity);
router.get('/', activityController.getActivities);
router.get('/:id', activityController.getActivityById);
router.get('/range', activityController.getActivitiesByDateRange);

module.exports = router;
