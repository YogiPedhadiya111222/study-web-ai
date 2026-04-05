const Task = require('../models/Task');
const Session = require('../models/Session');
const { calcDurationMinutes, getSessionDurationMinutes } = require('../utils/timeUtils');
const { refreshTaskPriority } = require('../services/recommendationService');
const {
  analyzeDistraction,
  getSuggestedPlannedDurationMinutes,
  normalizeDistractionTag,
  sanitizePlannedDurationMinutes,
} = require('../services/distractionService');

const SESSION_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
};

const LINKED_SESSION_FILTER = {
  taskId: { $exists: true, $ne: null },
};

const OPEN_SESSION_FILTER = {
  ...LINKED_SESSION_FILTER,
  $or: [{ endTime: { $exists: false } }, { endTime: null }],
};

const COMPLETED_SESSION_FILTER = {
  ...LINKED_SESSION_FILTER,
  endTime: { $exists: true, $ne: null },
};

const SESSION_FIELDS =
  'taskId startTime endTime plannedDurationMinutes durationMinutes pauseCount appSwitchCount distractionTag distractionDetected distractionFlags distractionTimeMinutes productivityScore productivityLabel status isPaused pausedAt totalPausedMs totalPausedTime createdAt updatedAt';

const populateSessionTask = (query) => query.populate('taskId', 'title subject status expectedStudyMinutes');

const getSessionTaskId = (session) => {
  if (!session?.taskId) return null;
  return typeof session.taskId === 'object' && session.taskId._id ? String(session.taskId._id) : String(session.taskId);
};

const getStoredPausedMs = (session) => {
  if (typeof session.totalPausedMs === 'number') {
    return session.totalPausedMs;
  }

  return Math.max(0, (session.totalPausedTime || 0) * 60 * 1000);
};

const getTotalPausedMs = (session, comparisonTime = new Date()) => {
  const basePausedTime = getStoredPausedMs(session);
  if (!session.pausedAt || session.endTime) return basePausedTime;

  const pausedAt = new Date(session.pausedAt).getTime();
  const comparison = new Date(comparisonTime).getTime();
  if (isNaN(pausedAt) || isNaN(comparison) || comparison <= pausedAt) return basePausedTime;

  return basePausedTime + (comparison - pausedAt);
};

const getSessionStatus = (session) => {
  if (!session) return SESSION_STATUS.COMPLETED;
  if (session.endTime) return SESSION_STATUS.COMPLETED;
  if (session.status) return session.status;
  return session.isPaused ? SESSION_STATUS.PAUSED : SESSION_STATUS.ACTIVE;
};

const hasLinkedTask = (session) => Boolean(getSessionTaskId(session));

const normalizeSession = (session) => {
  if (!session) return session;

  const comparisonTime = session.endTime || new Date();
  const totalPausedMs = getTotalPausedMs(session, comparisonTime);
  const durationMinutes = session.endTime ? getSessionDurationMinutes(session) : 0;
  const plannedDurationMinutes = sanitizePlannedDurationMinutes(
    session.plannedDurationMinutes,
    getSuggestedPlannedDurationMinutes(session.taskId),
  );
  const pauseCount = Math.max(0, session.pauseCount || 0);
  const appSwitchCount = Math.max(0, session.appSwitchCount || 0);
  const distractionAnalysis = analyzeDistraction({
    actualDurationMinutes: durationMinutes,
    plannedDurationMinutes,
    pauseCount,
    totalPausedMinutes: Math.floor(totalPausedMs / 1000 / 60),
    appSwitchCount,
  });

  session.status = getSessionStatus(session);
  session.isPaused = session.status === SESSION_STATUS.PAUSED;
  session.plannedDurationMinutes = plannedDurationMinutes;
  session.durationMinutes = durationMinutes;
  session.actualDurationMinutes = durationMinutes;
  session.pauseCount = pauseCount;
  session.appSwitchCount = appSwitchCount;
  session.totalPausedMs = totalPausedMs;
  session.totalPausedTime = Math.floor(totalPausedMs / 1000 / 60);
  session.distractionDetected = Boolean(session.distractionDetected ?? distractionAnalysis.distractionDetected);
  session.distractionFlags = Array.isArray(session.distractionFlags) && session.distractionFlags.length
    ? session.distractionFlags
    : distractionAnalysis.distractionFlags;
  session.distractionTimeMinutes =
    typeof session.distractionTimeMinutes === 'number'
      ? session.distractionTimeMinutes
      : distractionAnalysis.distractionTimeMinutes;
  session.productivityScore =
    typeof session.productivityScore === 'number' ? session.productivityScore : distractionAnalysis.productivityScore;
  session.productivityLabel = session.productivityLabel || distractionAnalysis.productivityLabel;
  const totalFocusWindow = durationMinutes + Math.max(0, session.distractionTimeMinutes || 0);
  session.focusRatio = totalFocusWindow > 0 ? Math.round((durationMinutes / totalFocusWindow) * 100) : 0;
  session.trackedMinutes =
    session.status === SESSION_STATUS.COMPLETED
      ? durationMinutes
      : calcDurationMinutes(session.startTime, comparisonTime, totalPausedMs);
  return session;
};

const syncPausedDuration = (session, comparisonTime = new Date()) => {
  session.totalPausedMs = getTotalPausedMs(session, comparisonTime);
  session.totalPausedTime = Math.floor(session.totalPausedMs / 1000 / 60);
};

const getTaskStudyMinutes = async (taskId) => {
  const sessions = await Session.find(
    {
      ...COMPLETED_SESSION_FILTER,
      taskId,
    },
    'startTime endTime totalPausedMs totalPausedTime durationMinutes',
  ).lean();

  return sessions.reduce((sum, studySession) => sum + getSessionDurationMinutes(studySession), 0);
};

const populateSessionById = async (sessionId) => {
  const session = normalizeSession(await populateSessionTask(Session.findById(sessionId, SESSION_FIELDS).lean()));
  return hasLinkedTask(session) ? session : null;
};

const findOpenSession = async (taskId = null) => {  
  const filter = { ...OPEN_SESSION_FILTER };
  if (taskId) {
    filter.taskId = taskId;
  }

  const session = await populateSessionTask(Session.findOne(filter, SESSION_FIELDS).sort({ startTime: -1 }));
  const normalizedSession = normalizeSession(session);
  return hasLinkedTask(normalizedSession) ? normalizedSession : null;
};

const markTaskInProgress = async (taskId) => {
  const task = await Task.findById(taskId, 'status');
  if (!task) return null;

  if (task.status !== 'completed' && task.status !== 'in-progress') {
    task.status = 'in-progress';
    await task.save();
  }

  return task;
};

const startSession = async (req, res, next) => {
  try {
    const { taskId, plannedDurationMinutes } = req.body;
    if (!taskId) return res.status(400).json({ message: 'taskId is required' });

    const existingSessionForTask = await findOpenSession(taskId);
    if (existingSessionForTask) {
      if (getSessionStatus(existingSessionForTask) === SESSION_STATUS.PAUSED && existingSessionForTask.pausedAt) {
        syncPausedDuration(existingSessionForTask);
        existingSessionForTask.status = SESSION_STATUS.ACTIVE;
        existingSessionForTask.isPaused = false;
        existingSessionForTask.pausedAt = undefined;
        await existingSessionForTask.save();
      }

      const task = await markTaskInProgress(taskId);
      if (!task) return res.status(404).json({ message: 'Task not found' });

      return res.status(200).json(await populateSessionById(existingSessionForTask._id));
    }

    const otherOpenSession = await findOpenSession();
    if (otherOpenSession) {
      return res.status(409).json({
        message: getSessionStatus(otherOpenSession) === SESSION_STATUS.PAUSED
          ? 'A study session is currently paused. Resume or stop it before starting a new one.'
          : 'A study session is already running. Stop or pause it before starting a new one.',
      });
    }

    const task = await Task.findById(taskId, 'status sessionHistory expectedStudyMinutes');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.status === 'completed') {
      return res.status(400).json({
        message: 'This task is already completed. Create a new task or reopen it before starting another session.',
      });
    }

    const normalizedPlannedDurationMinutes = sanitizePlannedDurationMinutes(
      plannedDurationMinutes,
      getSuggestedPlannedDurationMinutes(task),
    );

    const session = await Session.create({
      taskId,
      startTime: new Date(),
      plannedDurationMinutes: normalizedPlannedDurationMinutes,
      pauseCount: 0,
      appSwitchCount: 0,
      distractionDetected: false,
      distractionFlags: [],
      distractionTimeMinutes: 0,
      productivityScore: 0,
      productivityLabel: 'Needs improvement',
      status: SESSION_STATUS.ACTIVE,
      isPaused: false,
      totalPausedMs: 0,
      totalPausedTime: 0,
    });

    task.status = 'in-progress';
    if (!task.sessionHistory.some((sessionId) => String(sessionId) === String(session._id))) {
      task.sessionHistory.push(session._id);
    }
    await task.save();

    res.status(201).json(await populateSessionById(session._id));
  } catch (err) {
    next(err);
  }
};

const pauseSession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' });

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (!hasLinkedTask(session)) {
      return res.status(409).json({ message: 'This session is not linked to a task. Refresh and start a new task session.' });
    }
    if (session.endTime) return res.status(400).json({ message: 'Session already completed' });
    if (getSessionStatus(session) === SESSION_STATUS.PAUSED) {
      return res.json(await populateSessionById(session._id));
    }

    session.status = SESSION_STATUS.PAUSED;
    session.isPaused = true;
    session.pausedAt = new Date();
    session.pauseCount = Math.max(0, session.pauseCount || 0) + 1;
    await session.save();

    res.json(await populateSessionById(session._id));
  } catch (err) {
    next(err);
  }
};

const resumeSession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' });

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (!hasLinkedTask(session)) {
      return res.status(409).json({ message: 'This session is not linked to a task. Refresh and start a new task session.' });
    }
    if (session.endTime) return res.status(400).json({ message: 'Session already completed' });
    if (getSessionStatus(session) !== SESSION_STATUS.PAUSED) {
      return res.json(await populateSessionById(session._id));
    }

    syncPausedDuration(session);
    session.status = SESSION_STATUS.ACTIVE;
    session.isPaused = false;
    session.pausedAt = undefined;
    await session.save();

    await markTaskInProgress(session.taskId);

    res.json(await populateSessionById(session._id));
  } catch (err) {
    next(err);
  }
};

const stopSession = async (req, res, next) => {
  try {
    const { sessionId, appSwitchCount } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' });

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (!hasLinkedTask(session)) {
      return res.status(409).json({ message: 'This session is not linked to a task. Refresh and start a new task session.' });
    }
    if (session.endTime) {
      return res.json(await populateSessionById(session._id));
    }

    const stopTime = new Date();
    const totalPausedMs = getTotalPausedMs(session, stopTime);
    const durationMinutes = calcDurationMinutes(session.startTime, stopTime, totalPausedMs);
    const normalizedAppSwitchCount = Math.max(0, Number(appSwitchCount ?? session.appSwitchCount ?? 0) || 0);
    const plannedDurationMinutes = sanitizePlannedDurationMinutes(
      session.plannedDurationMinutes,
      getSuggestedPlannedDurationMinutes(session.taskId),
    );
    const distractionAnalysis = analyzeDistraction({
      actualDurationMinutes: durationMinutes,
      plannedDurationMinutes,
      pauseCount: session.pauseCount,
      totalPausedMinutes: Math.floor(totalPausedMs / 1000 / 60),
      appSwitchCount: normalizedAppSwitchCount,
    });
    const stoppedSession = await Session.findOneAndUpdate(
      {
        _id: sessionId,
        $or: [{ endTime: { $exists: false } }, { endTime: null }],
      },
      {
        $set: {
          endTime: stopTime,
          plannedDurationMinutes,
          durationMinutes,
          appSwitchCount: normalizedAppSwitchCount,
          distractionDetected: distractionAnalysis.distractionDetected,
          distractionFlags: distractionAnalysis.distractionFlags,
          distractionTimeMinutes: distractionAnalysis.distractionTimeMinutes,
          productivityScore: distractionAnalysis.productivityScore,
          productivityLabel: distractionAnalysis.productivityLabel,
          totalPausedMs,
          totalPausedTime: Math.floor(totalPausedMs / 1000 / 60),
          status: SESSION_STATUS.COMPLETED,
          isPaused: false,
        },
        $unset: {
          pausedAt: 1,
        },
      },
      { new: true },
    );

    if (!stoppedSession) {
      return res.json(await populateSessionById(sessionId));
    }

    const task = await Task.findById(
      stoppedSession.taskId,
      'expectedStudyMinutes totalStudyTime realStudyMinutes progress status lastStudiedAt',
    );
    if (!task) return res.status(404).json({ message: 'Linked task not found' });

    const totalStudyTime = await getTaskStudyMinutes(stoppedSession.taskId);
    task.totalStudyTime = totalStudyTime;
    task.realStudyMinutes = totalStudyTime;
    task.lastStudiedAt = stoppedSession.endTime;

    if ((task.expectedStudyMinutes || 0) > 0) {
      task.progress = Math.min(100, Math.round((totalStudyTime / task.expectedStudyMinutes) * 100));
    }

    if (task.progress >= 100) {
      task.status = 'completed';
    } else if (totalStudyTime > 0 || task.progress > 0) {
      task.status = 'in-progress';
    }
    await task.save();

    await refreshTaskPriority(task._id);
    res.json(await populateSessionById(stoppedSession._id));
  } catch (err) {
    next(err);
  }
};

const getActiveSession = async (req, res, next) => {
  try {
    const activeSession = await findOpenSession();
    res.json(activeSession);
  } catch (err) {
    next(err);
  }
};

const getSessions = async (req, res, next) => {
  try {
    const sessions = await populateSessionTask(
      Session.find(LINKED_SESSION_FILTER, SESSION_FIELDS).sort({ startTime: -1 }).lean(),
    );
    res.json(sessions.map(normalizeSession).filter(hasLinkedTask));
  } catch (err) {
    next(err);
  }
};

const getSessionById = async (req, res, next) => {
  try {
    const session = await populateSessionById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    next(err);
  }
};

const updateSessionReflection = async (req, res, next) => {
  try {
    const { distractionTag } = req.body;
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (!hasLinkedTask(session)) {
      return res.status(409).json({ message: 'This session is not linked to a task. Refresh and try again.' });
    }

    const normalizedDistractionTag = normalizeDistractionTag(distractionTag);
    session.distractionTag = normalizedDistractionTag || undefined;
    await session.save();

    res.json(await populateSessionById(session._id));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  getActiveSession,
  getSessions,
  getSessionById,
  updateSessionReflection,
};
