function pad(value) {
  return `${value}`.padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonthLabel(year, month) {
  return `${year}年${month}月`;
}

function parseDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function compareDateString(left, right) {
  return left.localeCompare(right);
}

function toClockText(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getToday() {
  return formatDate(new Date());
}

function addDays(baseDateString, offset) {
  const date = parseDate(baseDateString);
  date.setDate(date.getDate() + offset);
  return formatDate(date);
}

function getMonthCalendar(year, month, recordMap, selectedDate, todayString) {
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const offset = index - firstWeekDay + 1;
    let cellDate = null;

    if (offset <= 0) {
      cellDate = new Date(year, month - 2, prevMonthDays + offset);
    } else if (offset > daysInMonth) {
      cellDate = new Date(year, month - 1, offset);
    } else {
      cellDate = new Date(year, month - 1, offset);
    }

    const fullDate = formatDate(cellDate);
    const dayRecords = recordMap[fullDate] || [];
    const tags = dayRecords.slice(0, 2).map((item) => item.projectName);

    cells.push({
      key: `${fullDate}-${index}`,
      fullDate,
      dayNumber: cellDate.getDate(),
      isCurrentMonth: cellDate.getMonth() === month - 1,
      isToday: fullDate === todayString,
      isSelected: fullDate === selectedDate,
      isFuture: compareDateString(fullDate, todayString) > 0,
      tags,
      moreCount: dayRecords.length > 2 ? dayRecords.length - 2 : 0,
      totalDuration: dayRecords.reduce((sum, item) => sum + Number(item.duration || 0), 0),
    });
  }

  return cells;
}

function getDateRangeLabel(startDate, endDate) {
  if (!startDate || !endDate) {
    return '';
  }

  return `${startDate} 至 ${endDate}`;
}

function isNowInQuietHours(startTime, endTime, currentDate) {
  if (!startTime || !endTime || startTime === endTime) {
    return false;
  }

  const now = currentDate || new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

module.exports = {
  addDays,
  compareDateString,
  formatDate,
  formatMonthLabel,
  getDateRangeLabel,
  getMonthCalendar,
  getToday,
  isNowInQuietHours,
  pad,
  parseDate,
  toClockText,
};
