const Task = require('../models/Task');
const Session = require('../models/Session');
const { refreshTaskPriority, refreshAllTaskPriorities } = require('../services/recommendationService');
const { getSessionDurationMinutes } = require('../utils/timeUtils');

const OPEN_SESSION_FILTER = {
  $or: [{ endTime: { $exists: false } }, { endTime: null }],
};

const TASK_SESSION_POPULATE = {
  path: 'sessionHistory',
  select: 'taskId startTime endTime durationMinutes status isPaused pausedAt totalPausedMs totalPausedTime createdAt updatedAt',
};

const normalizeTaskUpdates = (updates = {}) => {
  const normalizedUpdates = { ...updates };

  delete normalizedUpdates.totalStudyTime;
  delete normalizedUpdates.realStudyMinutes;
  delete normalizedUpdates.sessionHistory;

  if (normalizedUpdates.status === 'completed') {
    normalizedUpdates.progress = 100;
    if (!normalizedUpdates.lastStudiedAt) {
      normalizedUpdates.lastStudiedAt = new Date();
    }
  }

  return normalizedUpdates;
};

const syncTaskStudyMetrics = (task) => {
  if (!task) {
    return task;
  }

  const completedSessions = Array.isArray(task.sessionHistory)
    ? task.sessionHistory.filter((session) => session?.endTime)
    : [];

  const totalStudyTime = completedSessions.reduce(
    (sum, session) => sum + getSessionDurationMinutes(session),
    0,
  );

  task.totalStudyTime = totalStudyTime;
  task.realStudyMinutes = totalStudyTime;

  const lastCompletedSession = completedSessions.reduce((latestSession, session) => {
    if (!latestSession?.endTime) {
      return session;
    }

    return new Date(session.endTime) > new Date(latestSession.endTime) ? session : latestSession;
  }, null);

  if (lastCompletedSession?.endTime) {
    task.lastStudiedAt = lastCompletedSession.endTime;
  }

  return task;
};

const createTask = async (req, res, next) => {
  try {
    const task = await Task.create({
      ...normalizeTaskUpdates(req.body),
      totalStudyTime: 0,
      realStudyMinutes: 0,
    });
    task.priority = await refreshTaskPriority(task._id);
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
};

const getTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find().populate(TASK_SESSION_POPULATE).lean();
    res.json(tasks.map(syncTaskStudyMetrics));
  } catch (err) {
    next(err);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate(TASK_SESSION_POPULATE).lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(syncTaskStudyMetrics(task));
  } catch (err) {
    next(err);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const updates = normalizeTaskUpdates(req.body);

    if (updates.status === 'completed') {
      const openSession = await Session.exists({
        taskId: req.params.id,
        ...OPEN_SESSION_FILTER,
      });

      if (openSession) {
        return res.status(409).json({
          message: 'Stop the live session before marking this task as completed.',
        });
      }
    }

    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.priority = await refreshTaskPriority(task._id);
    await task.save();

    const populatedTask = await Task.findById(task._id).populate(TASK_SESSION_POPULATE).lean();
    res.json(syncTaskStudyMetrics(populatedTask));
  } catch (err) {
    next(err);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const [tasks, sessions] = await Promise.all([
      Task.find({}, 'status progress').lean(),
      Session.find({ endTime: { $exists: true, $ne: null } }, 'startTime endTime totalPausedMs totalPausedTime durationMinutes').lean(),
    ]);
    const totalTasks = tasks.length;
    const totalStudyMinutes = sessions.reduce((sum, session) => sum + getSessionDurationMinutes(session), 0);
    let completedTasks = 0;
    let inProgress = 0;
    let pending = 0;
    let totalProgress = 0;

    for (const task of tasks) {
      if (task.status === 'completed') completedTasks += 1;
      else if (task.status === 'in-progress') inProgress += 1;
      else if (task.status === 'pending') pending += 1;

      totalProgress += task.progress || 0;
    }

    const progress = totalTasks ? Math.round(totalProgress / totalTasks) : 0;

    await refreshAllTaskPriorities();

    res.json({ totalTasks, totalStudyMinutes, completedTasks, inProgress, pending, averageProgress: progress });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getSummary,
};
