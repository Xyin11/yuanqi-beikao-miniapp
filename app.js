const storage = require('./utils/storage');
const dateUtils = require('./utils/date');

App({
  globalData: {
    listeners: {},
    reminderTimer: null,
    reminderModalVisible: false,
  },

  onLaunch() {
    storage.ensureDefaults();
  },

  onShow() {
    this.startWaterReminderTimer();
  },

  onHide() {
    this.stopWaterReminderTimer();
  },

  subscribe(eventName, handler) {
    if (!this.globalData.listeners[eventName]) {
      this.globalData.listeners[eventName] = [];
    }
    this.globalData.listeners[eventName].push(handler);
  },

  unsubscribe(eventName, handler) {
    const handlers = this.globalData.listeners[eventName] || [];
    this.globalData.listeners[eventName] = handlers.filter((item) => item !== handler);
  },

  publish(eventName, payload) {
    const handlers = this.globalData.listeners[eventName] || [];
    handlers.forEach((handler) => handler(payload));
  },

  notifyStorageUpdate(moduleName) {
    this.publish('storageUpdate', {
      moduleName,
      updatedAt: Date.now(),
    });
  },

  startWaterReminderTimer() {
    this.stopWaterReminderTimer();

    // 小程序不接入后端时，只能在前台运行期间做本地提醒轮询。
    this.globalData.reminderTimer = setInterval(() => {
      this.checkWaterReminder();
    }, 60 * 1000);
  },

  stopWaterReminderTimer() {
    if (this.globalData.reminderTimer) {
      clearInterval(this.globalData.reminderTimer);
      this.globalData.reminderTimer = null;
    }
  },

  resetWaterReminderCountdown() {
    const today = dateUtils.formatDate(new Date());
    storage.setWaterReminderState({
      date: today,
      lastReminderAt: Date.now(),
    });
  },

  checkWaterReminder() {
    const pages = getCurrentPages();
    if (!pages.length || this.globalData.reminderModalVisible) {
      return;
    }

    const settings = storage.getWaterSettings();
    if (!settings.reminderInterval || Number(settings.reminderInterval) <= 0) {
      return;
    }

    if (dateUtils.isNowInQuietHours(settings.quietStart, settings.quietEnd)) {
      return;
    }

    const today = dateUtils.formatDate(new Date());
    const todayAmount = storage
      .getWaterRecordsByDate(today)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    if (todayAmount >= Number(settings.target || 0)) {
      return;
    }

    const reminderState = storage.getWaterReminderState();
    if (reminderState.date !== today) {
      storage.setWaterReminderState({
        date: today,
        lastReminderAt: Date.now(),
      });
      return;
    }

    const intervalMs = Number(settings.reminderInterval) * 60 * 1000;
    if (Date.now() - Number(reminderState.lastReminderAt || 0) < intervalMs) {
      return;
    }

    this.globalData.reminderModalVisible = true;
    storage.setWaterReminderState({
      date: today,
      lastReminderAt: Date.now(),
    });

    wx.showModal({
      title: '喝水提醒',
      content: '该补水啦，喝一杯水再继续冲刺复习吧。',
      cancelText: '稍后再说',
      confirmText: '去记录',
      success: (res) => {
        if (res.confirm) {
          const currentPage = pages[pages.length - 1];
          if (!currentPage || currentPage.route !== 'pages/water/water') {
            wx.redirectTo({
              url: '/pages/water/water',
            });
          }
        }
      },
      complete: () => {
        this.globalData.reminderModalVisible = false;
      },
    });
  },
});
