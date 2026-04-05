const Task = require('../models/Task');
const Test = require('../models/Test');
const Activity = require('../models/Activity');

const RECENT_ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const buildPriorityContext = async (taskIds = []) => {
  const [tests, recentActivities] = await Promise.all([
    taskIds.length ? Test.find({ taskId: { $in: taskIds } }, 'taskId score').lean() : Promise.resolve([]),
    Activity.find({ timestamp: { $gte: new Date(Date.now() - RECENT_ACTIVITY_WINDOW_MS) } }, 'category').lean(),
  ]);

  const testScoresByTask = new Map();
  for (const test of tests) {
    const taskKey = String(test.taskId);
    const taskScores = testScoresByTask.get(taskKey) ?? { total: 0, count: 0 };
    taskScores.total += test.score;
    taskScores.count += 1;
    testScoresByTask.set(taskKey, taskScores);
  }

  let distractionCount = 0;
  for (const activity of recentActivities) {
    if (activity.category === 'distraction') {
      distractionCount += 1;
    }
  }

  return {
    activityFactor: recentActivities.length > 0 ? (distractionCount / recentActivities.length) * 50 : 0,
    testScoresByTask,
  };
};

const calculatePriority = (task, context) => {
  const deadlineFactor = task.deadline ? Math.max(0, 30 - ((new Date(task.deadline) - new Date()) / (1000 * 60 * 60 * 24))) : 0;
  const progressFactor = 100 - (task.progress || 0);
  const studyMinutes = task.totalStudyTime ?? task.realStudyMinutes ?? 0;
  const studyFactor = Math.min(100, studyMinutes);
  const difficultyFactor = ((task.difficulty || 3) / 5) * 100;
  const recency = task.lastStudiedAt ? Math.max(0, 30 - ((new Date() - new Date(task.lastStudiedAt)) / (1000 * 60 * 60 * 24))) : 30;

  const testScores = context.testScoresByTask.get(String(task._id));
  const avgTestScore = testScores ? testScores.total / testScores.count : 100;
  const testFactor = 100 - avgTestScore;

  const activityFactor = context.activityFactor;

  const weighted = deadlineFactor * 0.2 + progressFactor * 0.15 + (100 - Math.min(100, studyFactor)) * 0.15 + difficultyFactor * 0.15 + recency * 0.1 + testFactor * 0.15 + activityFactor * 0.1;
  return Math.round(weighted);
};

const computePriority = async (task) => {
  const context = await buildPriorityContext([task._id]);
  return calculatePriority(task, context);
};

const getWeakSubjects = async () => {
  const [tasks, tests] = await Promise.all([Task.find().lean(), Test.find({}, 'taskId score').lean()]);
  const subjectData = Object.create(null);
  const testScoresByTask = new Map();

  for (const test of tests) {
    const taskKey = String(test.taskId);
    const taskScores = testScoresByTask.get(taskKey) ?? { total: 0, count: 0 };
    taskScores.total += test.score;
    taskScores.count += 1;
    testScoresByTask.set(taskKey, taskScores);
  }

  for (const task of tasks) {
    if (!subjectData[task.subject]) {
      subjectData[task.subject] = { total: 0, completed: 0, progress: 0, taskCount: 0, testTotal: 0, testCount: 0 };
    }

    const studyMinutes = task.totalStudyTime ?? task.realStudyMinutes ?? 0;
    const subjectMetrics = subjectData[task.subject];
    const testScores = testScoresByTask.get(String(task._id));
    subjectMetrics.total += task.expectedStudyMinutes || 0;
    subjectMetrics.completed += studyMinutes;
    subjectMetrics.progress += task.progress || 0;
    subjectMetrics.taskCount += 1;
    subjectMetrics.testTotal += testScores?.total || 0;
    subjectMetrics.testCount += testScores?.count || 0;
  }

  const subjectRatings = Object.entries(subjectData).map(([subj, data]) => {
    const avgProgress = data.progress / Math.max(1, data.taskCount);
    const ratio = data.total ? (data.completed / data.total) : 0;
    const avgTestScore = data.testCount ? data.testTotal / data.testCount : 100;
    const weaknessScore = 100 - ((avgProgress + ratio * 100 + avgTestScore) / 3);
    return { subject: subj, weaknessScore: Math.round(weaknessScore) };
  });

  return subjectRatings.sort((a, b) => b.weaknessScore - a.weaknessScore).slice(0, 3);
};

const getRecommendations = async () => {
  const tasks = await Task.find().lean();
  const context = await buildPriorityContext(tasks.map((task) => task._id));
  const tasksWithPriority = tasks.map((task) => ({
    ...task,
    priority: calculatePriority(task, context),
  }));

  const recommendations = tasksWithPriority
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5)
    .map((t) => ({
      taskId: t._id,
      title: t.title,
      subject: t.subject,
      priority: t.priority,
      progress: t.progress,
      deadline: t.deadline,
    }));
  return recommendations;
};

const refreshTaskPriority = async (taskId) => {
  const task = await Task.findById(taskId);
  if (!task) return null;
  task.priority = await computePriority(task);
  await task.save();
  return task.priority;
};

const refreshAllTaskPriorities = async () => {
  const tasks = await Task.find();
  const context = await buildPriorityContext(tasks.map((task) => task._id));
  const updates = tasks.map(async (task) => {
    task.priority = calculatePriority(task, context);
    return task.save();
  });
  await Promise.all(updates);
};

module.exports = {
  computePriority,
  getWeakSubjects,
  getRecommendations,
  refreshTaskPriority,
  refreshAllTaskPriorities,
};
