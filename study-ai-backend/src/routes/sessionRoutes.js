const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

router.post('/start', sessionController.startSession);
router.post('/stop', sessionController.stopSession);
router.post('/pause', sessionController.pauseSession);
router.post('/resume', sessionController.resumeSession);
router.get('/active', sessionController.getActiveSession);
router.get('/', sessionController.getSessions);

// Debug route to check all sessions
router.get('/debug/all', async (req, res) => {
  try {
    const Session = require('../models/Session');
    const sessions = await Session.find({}).lean();
    res.json({ total: sessions.length, sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/reflection', sessionController.updateSessionReflection);
router.get('/:id', sessionController.getSessionById);

module.exports = router;
