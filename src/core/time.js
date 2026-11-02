// Date helpers. All calendar maths goes through local Date fields so that
// daylight saving changes (23 h / 25 h days) never shift a day boundary.
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

const pad = (n) => String(n).padStart(2, '0');

export const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const addDays = (ts, n) => {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

export const startOfWeek = (ts) => {
  const d = new Date(startOfDay(ts));
  const offset = (d.getDay() + 6) % 7;
  return addDays(d.getTime(), -offset);
};

export const atTime = (dayTs, hours, minutes) => {
  const d = new Date(dayTs);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
};

export const clock = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const isoDate = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const fromIso = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

export const isValidIso = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;
  return isoDate(fromIso(iso)) === iso;
};

/** Whole calendar days from a to b, immune to DST. */
export const calendarDays = (a, b) => {
  const utc = (ts) => {
    const d = new Date(ts);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.round((utc(b) - utc(a)) / DAY);
};

export const dur = (ms) => {
  if (Math.abs(ms) < MIN) return 'unter 1 Min';
  const total = Math.round(Math.abs(ms) / MIN);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} Min`;
  return m ? `${h} Std ${m} Min` : `${h} Std`;
};

/** Seconds matter for contractions, so this one stays exact below two minutes. */
export const durSeconds = (ms) => {
  const total = Math.round(Math.abs(ms) / 1000);
  if (total >= 120) return dur(ms);
  if (total < 60) return `${total} Sek`;
  const rest = total % 60;
  return rest ? `1 Min ${rest} Sek` : '1 Min';
};

export const stopwatch = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const weekday = (ts) => WEEKDAYS[new Date(ts).getDay()];
export const weekdayShort = (ts) => WEEKDAYS_SHORT[new Date(ts).getDay()];

export const dateLong = (ts) => {
  const d = new Date(ts);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const dateShort = (ts) => {
  const d = new Date(ts);
  return `${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`;
};

export const dayLabel = (ts, now) => {
  const diff = calendarDays(ts, now);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  const d = new Date(ts);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
};

export const dayWord = (ts, now) => {
  const diff = calendarDays(ts, now);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  return dateShort(ts);
};

export const ago = (ts, now) => {
  const diff = now - ts;
  if (diff < MIN) return 'gerade eben';
  if (diff < 12 * HOUR) return `vor ${dur(diff)}`;
  const days = calendarDays(ts, now);
  if (days === 0) return `heute ${clock(ts)}`;
  if (days === 1) return `gestern ${clock(ts)}`;
  return dateShort(ts);
};

export const ageLabel = (birthIso, now) => {
  const days = calendarDays(fromIso(birthIso), now);
  if (days < 0) return '';
  if (days === 0) return 'Heute geboren';
  if (days < 14) return days === 1 ? '1 Tag' : `${days} Tage`;
  if (days < 7 * 13) return `${Math.floor(days / 7)} Wochen`;
  const birth = new Date(fromIso(birthIso));
  const today = new Date(now);
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months -= 1;
  if (months < 24) return months === 1 ? '1 Monat' : `${months} Monate`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} Jahre ${rest} Mt.` : `${years} Jahre`;
};
