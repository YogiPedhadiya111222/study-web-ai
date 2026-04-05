const express = require('express');
const settingsController = require('../controllers/settingsController');

const router = express.Router();

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);
router.post('/reset', settingsController.resetSettings);
router.get('/export', settingsController.exportAppData);
router.delete('/data', settingsController.clearAppData);

module.exports = router;
