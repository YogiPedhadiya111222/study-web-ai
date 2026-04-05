const Activity = require('../models/Activity');
const Session = require('../models/Session');
const Task = require('../models/Task');
const Test = require('../models/Test');
const UserSettings = require('../models/UserSettings');
const { DEFAULT_SETTINGS, deepMerge, normalizeSettings } = require('../utils/settingsDefaults');

const resolveUserId = (req) => {
  const fromHeader = req.get('x-study-user-id');
  const fromQuery = typeof req.query?.userId === 'string' ? req.query.userId : undefined;
  const fromBody = typeof req.body?.userId === 'string' ? req.body.userId : undefined;
  const candidate = fromHeader || fromQuery || fromBody || DEFAULT_SETTINGS.userId;

  return String(candidate).trim() || DEFAULT_SETTINGS.userId;
};

const serializeSettings = (settingsDocument, userId) => {
  const normalized = normalizeSettings({
    ...(settingsDocument?.toObject ? settingsDocument.toObject() : settingsDocument),
    userId,
  });

  return {
    ...normalized,
    updatedAt: settingsDocument?.updatedAt ?? null,
    createdAt: settingsDocument?.createdAt ?? null,
  };
};

const getSettings = async (req, res, next) => {
  try {
    const userId = resolveUserId(req);
    const settings = await UserSettings.findOne({ userId });

    res.json(serializeSettings(settings, userId));
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const userId = resolveUserId(req);
    const existingSettings = await UserSettings.findOne({ userId }).lean();
    const mergedSettings = normalizeSettings(
      deepMerge(existingSettings ?? { userId }, { ...req.body, userId }),
    );

    const settings = await UserSettings.findOneAndUpdate(
      { userId },
      mergedSettings,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    );

    res.json({
      message: 'Settings saved successfully.',
      settings: serializeSettings(settings, userId),
    });
  } catch (error) {
    next(error);
  }
};

const resetSettings = async (req, res, next) => {
  try {
    const userId = resolveUserId(req);
    const settings = await UserSettings.findOneAndUpdate(
      { userId },
      { ...DEFAULT_SETTINGS, userId },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    );

    res.json({
      message: 'Settings reset to defaults.',
      settings: serializeSettings(settings, userId),
    });
  } catch (error) {
    next(error);
  }
};

const exportAppData = async (req, res, next) => {
  try {
    const userId = resolveUserId(req);
    const [settings, tasks, sessions, activities, tests] = await Promise.all([
      UserSettings.findOne({ userId }).lean(),
      Task.find({}).lean(),
      Session.find({}).lean(),
      Activity.find({}).lean(),
      Test.find({}).lean(),
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      userId,
      settings: serializeSettings(settings, userId),
      tasks,
      sessions,
      activities,
      tests,
    });
  } catch (error) {
    next(error);
  }
};

const clearAppData = async (req, res, next) => {
  try {
    const userId = resolveUserId(req);

    await Promise.all([
      Task.deleteMany({}),
      Session.deleteMany({}),
      Activity.deleteMany({}),
      Test.deleteMany({}),
      UserSettings.deleteMany({ userId }),
    ]);

    const settings = await UserSettings.create({ ...DEFAULT_SETTINGS, userId });

    res.json({
      message: 'All study data has been cleared.',
      settings: serializeSettings(settings, userId),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
  exportAppData,
  clearAppData,
};
