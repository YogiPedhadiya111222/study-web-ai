const Test = require('../models/Test');
const Task = require('../models/Task');
const { refreshTaskPriority } = require('../services/recommendationService');

const createTest = async (req, res, next) => {
  try {
    const { taskId, score, accuracy, topics, totalQuestions, correctAnswers } = req.body;
    if (!taskId || score === undefined || accuracy === undefined) {
      return res.status(400).json({ message: 'taskId, score, and accuracy are required' });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const test = await Test.create({ taskId, score, accuracy, topics, totalQuestions, correctAnswers });
    task.testHistory.push(test._id);
    await task.save();

    await refreshTaskPriority(taskId);
    res.status(201).json(test);
  } catch (err) {
    next(err);
  }
};

const getTests = async (req, res, next) => {
  try {
    const tests = await Test.find().populate('taskId');
    res.json(tests);
  } catch (err) {
    next(err);
  }
};

const getTestById = async (req, res, next) => {
  try {
    const test = await Test.findById(req.params.id).populate('taskId');
    if (!test) return res.status(404).json({ message: 'Test not found' });
    res.json(test);
  } catch (err) {
    next(err);
  }
};

const getTestsByTask = async (req, res, next) => {
  try {
    const tests = await Test.find({ taskId: req.params.taskId }).populate('taskId');
    res.json(tests);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTest,
  getTests,
  getTestById,
  getTestsByTask,
};
