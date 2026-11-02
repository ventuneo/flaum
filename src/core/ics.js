import { fromIso } from './time.js';

const pad = (n) => String(n).padStart(2, '0');

const stamp = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
};

const utcStamp = (ts) => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

const escapeText = (text) =>
  String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

function reminderStart(reminder, now) {
  if (reminder.at) return reminder.at;
  const d = new Date(reminder.date ? fromIso(reminder.date) : now);
  d.setHours(reminder.hour ?? 8, reminder.minute ?? 0, 0, 0);
  if (!reminder.date && d.getTime() < now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/**
 * Calendar file with an alert. The phone's calendar delivers it reliably even
 * with the app closed, which a website without a push server cannot do.
 */
export function reminderToIcs(reminder, now) {
  const start = reminderStart(reminder, now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Flaum//Erinnerung//DE',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${reminder.id}@flaum.local`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(start + 5 * 60_000)}`,
    `SUMMARY:${escapeText(reminder.title)}`,
  ];
  if (reminder.repeat === 'daily') lines.push('RRULE:FREQ=DAILY');
  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(reminder.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  );
  return `${lines.join('\r\n')}\r\n`;
}

/** Whether a reminder should fire now and has not fired for this occurrence yet. */
export function isDue(reminder, now) {
  if (reminder.deletedAt || reminder.enabled === false) return false;
  if (reminder.at) return reminder.at <= now && !reminder.firedAt;
  const d = new Date(now);
  d.setHours(reminder.hour ?? 8, reminder.minute ?? 0, 0, 0);
  const occurrence = d.getTime();
  return occurrence <= now && (reminder.firedAt ?? 0) < occurrence;
}
