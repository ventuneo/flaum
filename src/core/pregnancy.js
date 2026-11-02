import { calendarDays, fromIso } from './time.js';

const TERM_DAYS = 280;

/** Gestational age derived from the due date, written the Swiss way: 34+2. */
export function gestation(dueIso, now) {
  const daysLeft = calendarDays(now, fromIso(dueIso));
  const total = TERM_DAYS - daysLeft;
  if (total < 0) return null;
  const weeks = Math.floor(total / 7);
  const days = total % 7;
  return {
    weeks,
    days,
    label: `${weeks}+${days}`,
    daysLeft,
    overdue: daysLeft < 0,
    progress: Math.min(1, total / TERM_DAYS),
  };
}

export function isPlausibleDueDate(dueIso, now) {
  const left = calendarDays(now, fromIso(dueIso));
  return left >= -30 && left <= TERM_DAYS;
}
