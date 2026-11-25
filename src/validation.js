export function html(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function makeId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  throw new Error('Este navegador não oferece geração segura de identificadores.');
}

export function requireText(value, label, maxLength = 160) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} é obrigatório.`);
  if (text.length > maxLength) throw new Error(`${label} deve ter no máximo ${maxLength} caracteres.`);
  return text;
}

export function optionalText(value, maxLength = 2000) {
  const text = String(value ?? '').trim();
  if (text.length > maxLength) throw new Error(`O texto deve ter no máximo ${maxLength} caracteres.`);
  return text;
}

export function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function shiftDate(dateOnly, days) {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localDateFromInstant(instant) {
  const date = new Date(instant);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDate(dateOnly, options = { day: 'numeric', month: 'short' }) {
  if (!isValidDateOnly(dateOnly)) return 'Sem data';
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(year, month - 1, day, 12));
}

export function addRecurrence(dateOnly, recurrence) {
  if (!isValidDateOnly(dateOnly)) return todayLocal();
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (recurrence === 'daily') return shiftDate(dateOnly, 1);
  if (recurrence === 'weekly') return shiftDate(dateOnly, 7);
  if (recurrence === 'monthly') {
    const nextMonth = new Date(year, month, 1);
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
  }
  return dateOnly;
}

export function isOverdue(item, today = todayLocal()) {
  return item.status !== 'done' && Boolean(item.dueDate) && item.dueDate < today;
}

export function dueToday(habit, date = todayLocal()) {
  if (habit.frequency === 'daily') return true;
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return Array.isArray(habit.days) && habit.days.includes(weekday);
}

export function localDateTimeValue(instant) {
  if (!instant) return '';
  const date = new Date(instant);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalDateTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error('Informe uma data e hora válidas.');
  return date.toISOString();
}

export function isRecurringOn(event, dateOnly) {
  const startDate = localDateFromInstant(event.startAt);
  if (dateOnly < startDate) return false;
  if (event.recurrence === 'none') return dateOnly === startDate;
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (event.recurrence === 'daily') return true;
  if (event.recurrence === 'weekly') {
    const first = new Date(startYear, startMonth - 1, startDay, 12);
    const current = new Date(year, month - 1, day, 12);
    return current.getDay() === first.getDay();
  }
  if (event.recurrence === 'monthly') return day === startDay;
  return dateOnly === startDate;
}

export function nextRecurrenceDate(dateOnly, recurrence) {
  return addRecurrence(dateOnly, recurrence);
}
