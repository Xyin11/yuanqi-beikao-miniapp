const app = getApp();
const storage = require('../../utils/storage');
const dateUtils = require('../../utils/date');
const { encouragements } = require('../../data/messages');

function pickNewQuote(currentQuote) {
  if (encouragements.length <= 1) {
    return encouragements[0] || '';
  }

  let nextQuote = currentQuote;
  while (nextQuote === currentQuote) {
    nextQuote = encouragements[Math.floor(Math.random() * encouragements.length)];
  }

  return nextQuote;
}

Page({
  data: {
    currentQuote: '',
    noteInput: '',
    moodNotes: [],
    lastEncouragement: null,
  },

  onLoad() {
    storage.ensureDefaults();
    this.storageHandler = () => {
      this.refreshAll();
    };
    app.subscribe('storageUpdate', this.storageHandler);

    this.setData({
      currentQuote: pickNewQuote(''),
    });
    this.refreshAll();
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
    const moodNotes = storage
      .getMoodNotes()
      .slice()
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));

    this.setData({
      moodNotes,
      lastEncouragement: storage.getLastEncouragement(),
    });
  },

  refreshQuote() {
    this.setData({
      currentQuote: pickNewQuote(this.data.currentQuote),
    });
  },

  handleNoteInput(event) {
    this.setData({
      noteInput: event.detail.value,
    });
  },

  saveMoodNote() {
    const content = this.data.noteInput.trim();
    if (!content) {
      wx.showToast({
        title: '先写下一点心情吧',
        icon: 'none',
      });
      return;
    }

    const currentTimestamp = Date.now();
    const today = dateUtils.getToday();
    const moodNotes = storage.getMoodNotes().slice();

    moodNotes.unshift({
      id: `mood-${currentTimestamp}`,
      content,
      date: today,
      clockText: dateUtils.toClockText(new Date()),
      createdAt: currentTimestamp,
    });

    storage.setMoodNotes(moodNotes);
    app.notifyStorageUpdate('mood');

    this.setData(
      {
        noteInput: '',
      },
      () => {
        this.refreshAll();
      }
    );

    wx.showToast({
      title: '树洞已保存',
      icon: 'success',
    });
  },

  deleteMoodNote(event) {
    const { id } = event.currentTarget.dataset;

    wx.showModal({
      title: '删除树洞记录',
      content: '确认删除这条私密记录吗？',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const moodNotes = storage.getMoodNotes().filter((item) => item.id !== id);
        storage.setMoodNotes(moodNotes);
        app.notifyStorageUpdate('mood');
        this.refreshAll();

        wx.showToast({
          title: '已删除',
          icon: 'success',
        });
      },
    });
  },
});
