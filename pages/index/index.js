const app = getApp();
const storage = require('../../utils/storage');
const dateUtils = require('../../utils/date');
const { encouragements } = require('../../data/messages');

function aggregateProjectDuration(records) {
  // 统计逻辑统一按项目名称聚合，方便首页和区间统计复用。
  const bucket = {};

  records.forEach((item) => {
    const projectName = item.projectName || '未命名项目';
    bucket[projectName] = (bucket[projectName] || 0) + Number(item.duration || 0);
  });

  const stats = Object.keys(bucket)
    .map((name) => ({
      name,
      duration: bucket[name],
    }))
    .sort((left, right) => right.duration - left.duration);

  const maxDuration = stats.length ? stats[0].duration : 0;

  return stats.map((item) => ({
    ...item,
    barWidth: maxDuration ? Math.max(16, Math.round((item.duration / maxDuration) * 100)) : 0,
  }));
}

function getMonthStart(dateString) {
  const date = dateUtils.parseDate(dateString);
  return `${date.getFullYear()}-${dateUtils.pad(date.getMonth() + 1)}-01`;
}

function pickEncouragement() {
  const randomIndex = Math.floor(Math.random() * encouragements.length);
  return encouragements[randomIndex];
}

Page({
  data: {
    today: '',
    displayedYear: 0,
    displayedMonth: 0,
    monthLabel: '',
    weekLabels: ['一', '二', '三', '四', '五', '六', '日'],
    calendarDays: [],
    selectedDate: '',
    selectedRecords: [],
    projects: [],
    projectNames: [],
    selectedProjectIndex: 0,
    selectedProjectName: '',
    durationInput: '',
    modalProjectName: '',
    editingRecordId: '',
    editingProjectId: '',
    isPunchModalVisible: false,
    modalActive: false,
    modalTab: 'record',
    dailyTotalDuration: 0,
    dailyUsagePercent: 0,
    dailyUsageText: '0%',
    dailyProjectStats: [],
    rangeStartDate: '',
    rangeEndDate: '',
    rangeLabel: '',
    rangeProjectStats: [],
    rangeTotalDuration: 0,
    canvasSize: 180,
  },

  onLoad() {
    storage.ensureDefaults();
    this.pageReady = false;

    const today = dateUtils.getToday();
    const todayDate = dateUtils.parseDate(today);
    const systemInfo = wx.getSystemInfoSync();

    this.storageHandler = () => {
      this.refreshAll();
    };
    app.subscribe('storageUpdate', this.storageHandler);

    this.setData(
      {
        today,
        selectedDate: today,
        displayedYear: todayDate.getFullYear(),
        displayedMonth: todayDate.getMonth() + 1,
        rangeStartDate: getMonthStart(today),
        rangeEndDate: today,
        canvasSize: systemInfo.windowWidth >= 400 ? 200 : 180,
      },
      () => {
        this.refreshAll();
      }
    );
  },

  onShow() {
    this.refreshAll();
  },

  onReady() {
    this.pageReady = true;
    this.drawDailyUsageChart();
  },

  onUnload() {
    this.pageReady = false;
    if (this.storageHandler) {
      app.unsubscribe('storageUpdate', this.storageHandler);
    }

    if (this.modalTimer) {
      clearTimeout(this.modalTimer);
    }
  },

  noop() {},

  refreshAll() {
    const today = this.data.today || dateUtils.getToday();
    const selectedDateSeed = this.data.selectedDate || today;
    const selectedDateObj = dateUtils.parseDate(selectedDateSeed);
    const recordsMap = storage.getStudyRecords();
    const projects = storage.getProjects();
    let selectedDate = selectedDateSeed;
    const displayedYear = this.data.displayedYear || selectedDateObj.getFullYear();
    const displayedMonth = this.data.displayedMonth || selectedDateObj.getMonth() + 1;

    if (dateUtils.compareDateString(selectedDate, today) > 0) {
      selectedDate = today;
    }

    let rangeStartDate = this.data.rangeStartDate || getMonthStart(today);
    let rangeEndDate = this.data.rangeEndDate || today;

    if (dateUtils.compareDateString(rangeStartDate, rangeEndDate) > 0) {
      rangeEndDate = rangeStartDate;
    }

    const selectedRecords = (recordsMap[selectedDate] || [])
      .slice()
      .sort((left, right) => Number(right.updatedAt || right.createdAt) - Number(left.updatedAt || left.createdAt));

    const dailyTotalDuration = selectedRecords.reduce((sum, item) => sum + Number(item.duration || 0), 0);
    const usageRatio = dailyTotalDuration / 1440;
    const dailyUsagePercent = Math.min(usageRatio, 1);
    const dailyUsageText = `${Math.round(usageRatio * 100)}%`;
    const dailyProjectStats = aggregateProjectDuration(selectedRecords);

    const rangeProjectStats = this.buildRangeProjectStats(recordsMap, rangeStartDate, rangeEndDate);
    const rangeTotalDuration = rangeProjectStats.reduce((sum, item) => sum + item.duration, 0);

    let selectedProjectIndex = Number(this.data.selectedProjectIndex || 0);
    if (!projects.length) {
      selectedProjectIndex = 0;
    } else if (selectedProjectIndex > projects.length - 1) {
      selectedProjectIndex = 0;
    }

    const calendarDays = dateUtils.getMonthCalendar(
      displayedYear,
      displayedMonth,
      recordsMap,
      selectedDate,
      today
    );

    const projectNames = projects.map((item) => item.name);

    this.setData(
      {
        selectedDate,
        displayedYear,
        displayedMonth,
        monthLabel: dateUtils.formatMonthLabel(displayedYear, displayedMonth),
        calendarDays,
        selectedRecords,
        projects,
        projectNames,
        selectedProjectIndex,
        selectedProjectName: projectNames[selectedProjectIndex] || '',
        dailyTotalDuration,
        dailyUsagePercent,
        dailyUsageText,
        dailyProjectStats,
        rangeStartDate,
        rangeEndDate,
        rangeLabel: dateUtils.getDateRangeLabel(rangeStartDate, rangeEndDate),
        rangeProjectStats,
        rangeTotalDuration,
      },
      () => {
        if (this.pageReady) {
          this.drawDailyUsageChart();
        }
      }
    );
  },

  buildRangeProjectStats(recordsMap, startDate, endDate) {
    // 区间统计从全部打卡记录中筛日期，再复用项目聚合方法。
    const merged = [];

    Object.keys(recordsMap).forEach((dateKey) => {
      if (
        dateUtils.compareDateString(dateKey, startDate) >= 0 &&
        dateUtils.compareDateString(dateKey, endDate) <= 0
      ) {
        merged.push(...recordsMap[dateKey]);
      }
    });

    return aggregateProjectDuration(merged);
  },

  drawDailyUsageChart() {
    const size = this.data.canvasSize;
    const center = size / 2;
    const radius = center - 16;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * this.data.dailyUsagePercent;
    const context = wx.createCanvasContext('usageCanvas', this);

    context.clearRect(0, 0, size, size);
    context.setLineWidth(14);
    context.setLineCap('round');

    context.beginPath();
    context.setStrokeStyle('#e5eee8');
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.stroke();

    if (this.data.dailyUsagePercent > 0) {
      context.beginPath();
      context.setStrokeStyle('#82b996');
      context.arc(center, center, radius, startAngle, endAngle, false);
      context.stroke();
    }

    context.draw();
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

  changeMonth(step) {
    let year = this.data.displayedYear;
    let month = this.data.displayedMonth + step;

    if (month <= 0) {
      year -= 1;
      month = 12;
    }

    if (month >= 13) {
      year += 1;
      month = 1;
    }

    this.setData(
      {
        displayedYear: year,
        displayedMonth: month,
      },
      () => {
        this.refreshAll();
      }
    );
  },

  goPrevMonth() {
    this.changeMonth(-1);
  },

  goNextMonth() {
    this.changeMonth(1);
  },

  goToToday() {
    const today = this.data.today || dateUtils.getToday();
    const todayDate = dateUtils.parseDate(today);

    this.setData(
      {
        selectedDate: today,
        displayedYear: todayDate.getFullYear(),
        displayedMonth: todayDate.getMonth() + 1,
      },
      () => {
        this.refreshAll();
      }
    );
  },

  handleDayTap(event) {
    const { date, future } = event.currentTarget.dataset;

    if (future) {
      wx.showToast({
        title: '未来日期暂不支持打卡',
        icon: 'none',
      });
      return;
    }

    const selectedDate = String(date);
    const selectedDateObj = dateUtils.parseDate(selectedDate);

    this.setData(
      {
        selectedDate,
        displayedYear: selectedDateObj.getFullYear(),
        displayedMonth: selectedDateObj.getMonth() + 1,
        editingRecordId: '',
        durationInput: '',
      },
      () => {
        this.refreshAll();
        this.openRecordModal();
      }
    );
  },

  openRecordModal() {
    const nextTab = this.data.projects.length ? 'record' : 'project';
    if (this.modalTimer) {
      clearTimeout(this.modalTimer);
    }

    this.setData(
      {
        isPunchModalVisible: true,
        modalTab: nextTab,
      },
      () => {
        setTimeout(() => {
          this.setData({
            modalActive: true,
          });
        }, 20);
      }
    );
  },

  openQuickRecord() {
    const today = this.data.today || dateUtils.getToday();
    const todayDate = dateUtils.parseDate(today);
    this.setData(
      {
        selectedDate: today,
        displayedYear: todayDate.getFullYear(),
        displayedMonth: todayDate.getMonth() + 1,
        editingRecordId: '',
        durationInput: '',
      },
      () => {
        this.refreshAll();
        this.openRecordModal();
      }
    );
  },

  openProjectModal(resetForm = true) {
    if (this.modalTimer) {
      clearTimeout(this.modalTimer);
    }

    const patch = {
      isPunchModalVisible: true,
      modalTab: 'project',
    };

    if (resetForm) {
      patch.editingProjectId = '';
      patch.modalProjectName = '';
    }

    this.setData(
      patch,
      () => {
        setTimeout(() => {
          this.setData({
            modalActive: true,
          });
        }, 20);
      }
    );
  },

  closePunchModal() {
    this.setData({
      modalActive: false,
    });

    if (this.modalTimer) {
      clearTimeout(this.modalTimer);
    }

    this.modalTimer = setTimeout(() => {
      this.setData({
        isPunchModalVisible: false,
        editingRecordId: '',
        editingProjectId: '',
        durationInput: '',
        modalProjectName: '',
      });
    }, 220);
  },

  switchModalTab(event) {
    const { tab } = event.currentTarget.dataset;
    this.setData({
      modalTab: tab,
    });
  },

  handleProjectPickerChange(event) {
    const selectedProjectIndex = Number(event.detail.value);
    this.setData({
      selectedProjectIndex,
      selectedProjectName: this.data.projectNames[selectedProjectIndex] || '',
    });
  },

  handleDurationInput(event) {
    this.setData({
      durationInput: event.detail.value.replace(/[^\d]/g, ''),
    });
  },

  saveRecord() {
    if (!this.data.projects.length) {
      wx.showToast({
        title: '请先添加学习项目',
        icon: 'none',
      });
      this.setData({
        modalTab: 'project',
      });
      return;
    }

    const duration = Number(this.data.durationInput);
    if (!Number.isInteger(duration) || duration <= 0) {
      wx.showToast({
        title: '请输入正整数分钟数',
        icon: 'none',
      });
      return;
    }

    const selectedProject = this.data.projects[this.data.selectedProjectIndex];
    const dateKey = this.data.selectedDate;
    const records = storage.getStudyRecordsByDate(dateKey).slice();
    const currentTimestamp = Date.now();
    const nextRecord = {
      id: this.data.editingRecordId || `record-${currentTimestamp}`,
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      duration,
      clockText: dateUtils.toClockText(new Date()),
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
    };

    if (this.data.editingRecordId) {
      const recordIndex = records.findIndex((item) => item.id === this.data.editingRecordId);
      if (recordIndex !== -1) {
        nextRecord.createdAt = records[recordIndex].createdAt || currentTimestamp;
        records.splice(recordIndex, 1, nextRecord);
      }
    } else {
      records.push(nextRecord);
    }

    // 每次打卡完成后，同时留一条鼓励文案给树洞页读取。
    storage.saveStudyRecordsByDate(dateKey, records);

    const encourageText = pickEncouragement();
    storage.setLastEncouragement({
      text: encourageText,
      date: dateKey,
      createdAt: currentTimestamp,
    });

    app.notifyStorageUpdate('study');
    this.refreshAll();
    this.closePunchModal();

    wx.showToast({
      title: this.data.editingRecordId ? '打卡已更新' : '打卡完成',
      icon: 'success',
    });

    setTimeout(() => {
      wx.showModal({
        title: '学习结束提醒',
        content: encourageText,
        showCancel: false,
        confirmText: '继续加油',
      });
    }, 260);
  },

  editRecord(event) {
    const { id } = event.currentTarget.dataset;
    const record = this.data.selectedRecords.find((item) => item.id === id);

    if (!record) {
      return;
    }

    const projectIndex = this.data.projects.findIndex((item) => item.id === record.projectId);

    this.setData(
      {
        editingRecordId: record.id,
        durationInput: `${record.duration}`,
        selectedProjectIndex: projectIndex >= 0 ? projectIndex : 0,
        selectedProjectName: this.data.projectNames[projectIndex >= 0 ? projectIndex : 0] || '',
      },
      () => {
        this.openRecordModal();
      }
    );
  },

  deleteRecord(event) {
    const { id } = event.currentTarget.dataset;
    const dateKey = this.data.selectedDate;

    wx.showModal({
      title: '删除打卡',
      content: '确认删除这条学习记录吗？',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const records = storage
          .getStudyRecordsByDate(dateKey)
          .filter((item) => item.id !== id);

        storage.saveStudyRecordsByDate(dateKey, records);
        app.notifyStorageUpdate('study');
        this.refreshAll();

        wx.showToast({
          title: '已删除',
          icon: 'success',
        });
      },
    });
  },

  handleProjectNameInput(event) {
    this.setData({
      modalProjectName: event.detail.value,
    });
  },

  submitProjectForm() {
    const projectName = this.data.modalProjectName.trim();
    if (!projectName) {
      wx.showToast({
        title: '请输入项目名称',
        icon: 'none',
      });
      return;
    }

    const hasDuplicate = this.data.projects.some(
      (item) => item.name === projectName && item.id !== this.data.editingProjectId
    );
    if (hasDuplicate) {
      wx.showToast({
        title: '项目名称已存在',
        icon: 'none',
      });
      return;
    }

    const currentTimestamp = Date.now();
    const nextProjects = this.data.projects.slice();
    const isEditing = Boolean(this.data.editingProjectId);

    if (this.data.editingProjectId) {
      const editIndex = nextProjects.findIndex((item) => item.id === this.data.editingProjectId);
      if (editIndex !== -1) {
        nextProjects.splice(editIndex, 1, {
          ...nextProjects[editIndex],
          name: projectName,
        });
      }

      const nextRecords = storage.getStudyRecords();
      Object.keys(nextRecords).forEach((dateKey) => {
        nextRecords[dateKey] = nextRecords[dateKey].map((record) =>
          record.projectId === this.data.editingProjectId
            ? {
                ...record,
                projectName,
              }
            : record
        );
      });
      storage.setStudyRecords(nextRecords);
    } else {
      nextProjects.unshift({
        id: `project-${currentTimestamp}`,
        name: projectName,
        createdAt: currentTimestamp,
      });
    }

    storage.setProjects(nextProjects);
    app.notifyStorageUpdate('study');

    this.setData(
      {
        modalProjectName: '',
        editingProjectId: '',
      },
      () => {
        this.refreshAll();
      }
    );

    wx.showToast({
      title: isEditing ? '项目已更新' : '项目已新增',
      icon: 'success',
    });
  },

  startProjectEdit(event) {
    const { id } = event.currentTarget.dataset;
    const project = this.data.projects.find((item) => item.id === id);

    if (!project) {
      return;
    }

    this.setData(
      {
        editingProjectId: project.id,
        modalProjectName: project.name,
      },
      () => {
        this.openProjectModal(false);
      }
    );
  },

  deleteProject(event) {
    const { id } = event.currentTarget.dataset;

    wx.showModal({
      title: '删除项目',
      content: '删除后历史打卡会保留，但新打卡中将不再显示该项目。',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const nextProjects = this.data.projects.filter((item) => item.id !== id);
        storage.setProjects(nextProjects);
        app.notifyStorageUpdate('study');
        this.refreshAll();

        wx.showToast({
          title: '项目已删除',
          icon: 'success',
        });
      },
    });
  },

  handleRangeStartChange(event) {
    const startDate = event.detail.value;
    const endDate =
      dateUtils.compareDateString(startDate, this.data.rangeEndDate) > 0
        ? startDate
        : this.data.rangeEndDate;

    this.setData(
      {
        rangeStartDate: startDate,
        rangeEndDate: endDate,
      },
      () => {
        this.refreshAll();
      }
    );
  },

  handleRangeEndChange(event) {
    const endDate = event.detail.value;
    const startDate =
      dateUtils.compareDateString(this.data.rangeStartDate, endDate) > 0
        ? endDate
        : this.data.rangeStartDate;

    this.setData(
      {
        rangeStartDate: startDate,
        rangeEndDate: endDate,
      },
      () => {
        this.refreshAll();
      }
    );
  },

  useThisMonthRange() {
    const startDate = getMonthStart(this.data.today);

    this.setData(
      {
        rangeStartDate: startDate,
        rangeEndDate: this.data.today,
      },
      () => {
        this.refreshAll();
      }
    );
  },

  useLastSevenDaysRange() {
    this.setData(
      {
        rangeStartDate: dateUtils.addDays(this.data.today, -6),
        rangeEndDate: this.data.today,
      },
      () => {
        this.refreshAll();
      }
    );
  },
});
