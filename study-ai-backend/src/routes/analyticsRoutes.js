const express = require('express');
const router = express.Router();
const { getStudyAnalytics } = require('../services/analyticsService');

router.get('/', async (req, res, next) => {
  try {
    res.json(await getStudyAnalytics());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
