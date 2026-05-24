const app = getApp();
const storage = require('../../utils/storage');
const dateUtils = require('../../utils/date');

function buildHistoryDays(recordsMap, target, today) {
  const historyDays = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const dateKey = dateUtils.addDays(today, -offset);
    const totalAmount = (recordsMap[dateKey] || []).reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const ratio = target ? totalAmount / target : 0;

    historyDays.push({
      date: dateKey,
      amount: totalAmount,
      percentText: `${Math.round(ratio * 100)}%`,
      barWidth: Math.min(Math.round(ratio * 100), 100),
    });
  }

  return historyDays;
}

Page({
  data: {
    today: '',
    quickCups: [200, 300, 500, 750],
    manualAmountInput: '',
    targetInput: '2000',
    intervalInput: '90',
    quietStart: '23:00',
    quietEnd: '07:00',
    todayRecords: [],
    todayAmount: 0,
    remainingAmount: 2000,
    exceedAmount: 0,
    progressPercent: 0,
    progressText: '0%',
    historyDays: [],
  },

  onLoad() {
    storage.ensureDefaults();
    this.storageHandler = () => {
      this.refreshAll();
    };
    app.subscribe('storageUpdate', this.storageHandler);

    this.setData(
      {
        today: dateUtils.getToday(),
      },
      () => {
        this.refreshAll();
      }
    );
  },

  onShow() {
    this.refreshAll();
  },

  onUnload() {
    if (this.storageHandler) {
      app.unsubscribe('storageUpdate', this.storageHandler);
    }
  },

  switchPage(event) {
    const { url } = event.currentTarget.dataset;
    if (!url) {
      return;
    }

    wx.redirectTo({
      url,
    });
  },

  refreshAll() {
    const today = this.data.today || dateUtils.getToday();
    const settings = storage.getWaterSettings();
    const waterRecordsMap = storage.getWaterRecords();
    const todayRecords = (waterRecordsMap[today] || [])
      .slice()
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
    const todayAmount = todayRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const target = Number(settings.target || 0);
    const remainingAmount = Math.max(target - todayAmount, 0);
    const exceedAmount = todayAmount > target ? todayAmount - target : 0;
    const progressRatio = target ? todayAmount / target : 0;

    this.setData({
      targetInput: `${target}`,
      intervalInput: `${settings.reminderInterval}`,
      quietStart: settings.quietStart,
      quietEnd: settings.quietEnd,
      todayRecords,
      todayAmount,
      remainingAmount,
      exceedAmount,
      progressPercent: Math.min(Math.round(progressRatio * 100), 100),
      progressText: `${Math.round(progressRatio * 100)}%`,
      historyDays: buildHistoryDays(waterRecordsMap, target, today),
    });
  },

  handleManualAmountInput(event) {
    this.setData({
      manualAmountInput: event.detail.value.replace(/[^\d]/g, ''),
    });
  },

  addQuickCup(event) {
    const { amount } = event.currentTarget.dataset;
    this.saveWaterAmount(Number(amount), `常用水杯 ${amount}ml`);
  },

  addManualWater() {
    this.saveWaterAmount(Number(this.data.manualAmountInput), '手动输入');
  },

  saveWaterAmount(amount, source) {
    if (!Number.isInteger(amount) || amount <= 0) {
      wx.showToast({
        title: '请输入正整数水量',
        icon: 'none',
      });
      return;
    }

    const today = this.data.today || dateUtils.getToday();
    const currentTimestamp = Date.now();
    const todayRecords = storage.getWaterRecordsByDate(today).slice();

    todayRecords.unshift({
      id: `water-${currentTimestamp}`,
      amount,
      source,
      clockText: dateUtils.toClockText(new Date()),
      createdAt: currentTimestamp,
    });

    storage.saveWaterRecordsByDate(today, todayRecords);
    app.resetWaterReminderCountdown();
    app.notifyStorageUpdate('water');

    this.setData(
      {
        manualAmountInput: '',
      },
      () => {
        this.refreshAll();
      }
    );

    wx.showToast({
      title: '已记录喝水',
      icon: 'success',
    });
  },

  deleteWaterRecord(event) {
    const { id } = event.currentTarget.dataset;
    const today = this.data.today || dateUtils.getToday();

    wx.showModal({
      title: '删除饮水记录',
      content: '确认删除这条喝水记录吗？',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const todayRecords = storage
          .getWaterRecordsByDate(today)
          .filter((item) => item.id !== id);

        storage.saveWaterRecordsByDate(today, todayRecords);
        app.notifyStorageUpdate('water');
        this.refreshAll();

        wx.showToast({
          title: '已删除',
          icon: 'success',
        });
      },
    });
  },

  handleTargetInput(event) {
    this.setData({
      targetInput: event.detail.value.replace(/[^\d]/g, ''),
    });
  },

  handleIntervalInput(event) {
    this.setData({
      intervalInput: event.detail.value.replace(/[^\d]/g, ''),
    });
  },

  handleQuietStartChange(event) {
    this.setData({
      quietStart: event.detail.value,
    });
  },

  handleQuietEndChange(event) {
    this.setData({
      quietEnd: event.detail.value,
    });
  },

  saveSettings() {
    const target = Number(this.data.targetInput);
    const interval = Number(this.data.intervalInput || 0);

    if (!Number.isInteger(target) || target <= 0) {
      wx.showToast({
        title: '目标饮水量需为正整数',
        icon: 'none',
      });
      return;
    }

    if (!Number.isInteger(interval) || interval < 0) {
      wx.showToast({
        title: '提醒间隔需为非负整数',
        icon: 'none',
      });
      return;
    }

    storage.setWaterSettings({
      target,
      reminderInterval: interval,
      quietStart: this.data.quietStart,
      quietEnd: this.data.quietEnd,
    });

    app.resetWaterReminderCountdown();
    app.notifyStorageUpdate('water');
    this.refreshAll();

    wx.showToast({
      title: '设置已保存',
      icon: 'success',
    });
  },
});
