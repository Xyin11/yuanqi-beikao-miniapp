const dateUtils = require('./date');

const STORAGE_KEYS = {
  STUDY_PROJECTS: 'study_projects',
  STUDY_RECORDS: 'study_records',
  WATER_SETTINGS: 'water_settings',
  WATER_RECORDS: 'water_records',
  WATER_REMINDER_STATE: 'water_reminder_state',
  MOOD_NOTES: 'mood_notes',
  LAST_ENCOURAGEMENT: 'last_encouragement',
};

const DEFAULT_PROJECTS = [
  { id: 'project-politics', name: '政治', createdAt: Date.now() },
  { id: 'project-english', name: '英语', createdAt: Date.now() + 1 },
  { id: 'project-math', name: '数学', createdAt: Date.now() + 2 },
];

const DEFAULT_WATER_SETTINGS = {
  target: 2000,
  reminderInterval: 90,
  quietStart: '23:00',
  quietEnd: '07:00',
};

function safeGet(key, fallbackValue) {
  const value = wx.getStorageSync(key);
  return value === '' || value === undefined || value === null ? fallbackValue : value;
}

function ensureDefaults() {
  if (!wx.getStorageSync(STORAGE_KEYS.STUDY_PROJECTS)) {
    wx.setStorageSync(STORAGE_KEYS.STUDY_PROJECTS, DEFAULT_PROJECTS);
  }

  if (!wx.getStorageSync(STORAGE_KEYS.STUDY_RECORDS)) {
    wx.setStorageSync(STORAGE_KEYS.STUDY_RECORDS, {});
  }

  if (!wx.getStorageSync(STORAGE_KEYS.WATER_SETTINGS)) {
    wx.setStorageSync(STORAGE_KEYS.WATER_SETTINGS, DEFAULT_WATER_SETTINGS);
  }

  if (!wx.getStorageSync(STORAGE_KEYS.WATER_RECORDS)) {
    wx.setStorageSync(STORAGE_KEYS.WATER_RECORDS, {});
  }

  if (!wx.getStorageSync(STORAGE_KEYS.WATER_REMINDER_STATE)) {
    wx.setStorageSync(STORAGE_KEYS.WATER_REMINDER_STATE, {
      date: dateUtils.getToday(),
      lastReminderAt: Date.now(),
    });
  }

  if (!wx.getStorageSync(STORAGE_KEYS.MOOD_NOTES)) {
    wx.setStorageSync(STORAGE_KEYS.MOOD_NOTES, []);
  }

  if (!wx.getStorageSync(STORAGE_KEYS.LAST_ENCOURAGEMENT)) {
    wx.setStorageSync(STORAGE_KEYS.LAST_ENCOURAGEMENT, null);
  }
}

function getProjects() {
  return safeGet(STORAGE_KEYS.STUDY_PROJECTS, DEFAULT_PROJECTS);
}

function setProjects(projects) {
  wx.setStorageSync(STORAGE_KEYS.STUDY_PROJECTS, projects);
}

function getStudyRecords() {
  return safeGet(STORAGE_KEYS.STUDY_RECORDS, {});
}

function setStudyRecords(records) {
  wx.setStorageSync(STORAGE_KEYS.STUDY_RECORDS, records);
}

function getStudyRecordsByDate(dateString) {
  const allRecords = getStudyRecords();
  return allRecords[dateString] || [];
}

function saveStudyRecordsByDate(dateString, records) {
  const allRecords = getStudyRecords();
  allRecords[dateString] = records;
  wx.setStorageSync(STORAGE_KEYS.STUDY_RECORDS, allRecords);
}

function getWaterSettings() {
  return safeGet(STORAGE_KEYS.WATER_SETTINGS, DEFAULT_WATER_SETTINGS);
}

function setWaterSettings(settings) {
  wx.setStorageSync(STORAGE_KEYS.WATER_SETTINGS, settings);
}

function getWaterRecords() {
  return safeGet(STORAGE_KEYS.WATER_RECORDS, {});
}

function setWaterRecords(records) {
  wx.setStorageSync(STORAGE_KEYS.WATER_RECORDS, records);
}

function getWaterRecordsByDate(dateString) {
  const allRecords = getWaterRecords();
  return allRecords[dateString] || [];
}

function saveWaterRecordsByDate(dateString, records) {
  const allRecords = getWaterRecords();
  allRecords[dateString] = records;
  wx.setStorageSync(STORAGE_KEYS.WATER_RECORDS, allRecords);
}

function getWaterReminderState() {
  return safeGet(STORAGE_KEYS.WATER_REMINDER_STATE, {
    date: dateUtils.getToday(),
    lastReminderAt: Date.now(),
  });
}

function setWaterReminderState(reminderState) {
  wx.setStorageSync(STORAGE_KEYS.WATER_REMINDER_STATE, reminderState);
}

function getMoodNotes() {
  return safeGet(STORAGE_KEYS.MOOD_NOTES, []);
}

function setMoodNotes(notes) {
  wx.setStorageSync(STORAGE_KEYS.MOOD_NOTES, notes);
}

function getLastEncouragement() {
  return safeGet(STORAGE_KEYS.LAST_ENCOURAGEMENT, null);
}

function setLastEncouragement(payload) {
  wx.setStorageSync(STORAGE_KEYS.LAST_ENCOURAGEMENT, payload);
}

module.exports = {
  ensureDefaults,
  getLastEncouragement,
  getMoodNotes,
  getProjects,
  getStudyRecords,
  getStudyRecordsByDate,
  getWaterRecords,
  getWaterRecordsByDate,
  getWaterReminderState,
  getWaterSettings,
  saveStudyRecordsByDate,
  saveWaterRecordsByDate,
  setLastEncouragement,
  setMoodNotes,
  setProjects,
  setStudyRecords,
  setWaterRecords,
  setWaterReminderState,
  setWaterSettings,
};
