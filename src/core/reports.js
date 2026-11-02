import { addDays, atTime, startOfDay, DAY, HOUR, MIN, dur } from './time.js';

const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
const NIGHT_START = 19;
const NIGHT_END = 7;

/** Sleep minus night wakings inside [from, to). Long sleeps are split by the day they fall on. */
export function netSleep(entry, from, to) {
  const inside = overlap(entry.start, entry.end, from, to);
  if (!inside) return 0;
  const awake = (entry.data?.wakes ?? []).reduce(
    (sum, w) => sum + overlap(w.from, w.to ?? entry.end, from, to),
    0,
  );
  return Math.max(0, inside - awake);
}

const nightRanges = (day) => {
  const next = addDays(day, 1);
  return [
    [day, atTime(day, NIGHT_END, 0)],
    [atTime(day, NIGHT_START, 0), next],
  ];
};

function emptyDay(day) {
  return {
    day,
    sleep: { day: 0, night: 0, total: 0, naps: 0 },
    nursing: { ms: 0, count: 0, left: 0, right: 0 },
    bottle: { breast: 0, formula: 0, other: 0, total: 0, count: 0 },
    diaper: { wet: 0, dirty: 0, both: 0, dry: 0, total: 0 },
    potty: 0,
    pump: { ml: 0, count: 0 },
    solids: 0,
    activity: {},
    hasData: false,
  };
}

export function dayStats(entries, day) {
  const stats = emptyDay(day);
  const end = addDays(day, 1);
  for (const e of entries) {
    if (e.deletedAt) continue;
    if (e.type === 'sleep' && e.end) {
      const total = netSleep(e, day, end);
      if (!total) continue;
      const night = nightRanges(day).reduce((sum, [a, b]) => sum + netSleep(e, a, b), 0);
      stats.sleep.total += total;
      stats.sleep.night += night;
      stats.sleep.day += total - night;
      if (e.start >= day && e.start < end && e.end - e.start < 4 * HOUR) stats.sleep.naps += 1;
      stats.hasData = true;
      continue;
    }
    if (e.start < day || e.start >= end) continue;
    stats.hasData = true;
    const d = e.data ?? {};
    switch (e.type) {
      case 'nursing':
        stats.nursing.count += 1;
        stats.nursing.left += d.left ?? 0;
        stats.nursing.right += d.right ?? 0;
        stats.nursing.ms += (d.left ?? 0) + (d.right ?? 0);
        break;
      case 'bottle': {
        const key = d.kind === 'breast' || d.kind === 'formula' ? d.kind : 'other';
        stats.bottle[key] += d.ml ?? 0;
        stats.bottle.total += d.ml ?? 0;
        stats.bottle.count += 1;
        break;
      }
      case 'diaper':
        if (d.mode === 'potty') {
          stats.potty += 1;
        } else {
          const key = ['wet', 'dirty', 'both', 'dry'].includes(d.kind) ? d.kind : 'wet';
          stats.diaper[key] += 1;
          stats.diaper.total += 1;
        }
        break;
      case 'pump':
        stats.pump.ml += d.ml ?? 0;
        stats.pump.count += 1;
        break;
      case 'solids':
        stats.solids += 1;
        break;
      case 'activity':
        if (d.kind) stats.activity[d.kind] = (stats.activity[d.kind] ?? 0) + (d.ms ?? 0);
        break;
      default:
    }
  }
  return stats;
}

export function statsRange(entries, now, days) {
  const today = startOfDay(now);
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(dayStats(entries, addDays(today, -i)));
  return out;
}

export const METRICS = {
  sleep: {
    label: 'Schlaf',
    format: (v) => dur(v),
    axis: (v) => `${Math.round(v / HOUR)} Std`,
    step: 4 * HOUR,
    color: 'sleep',
    parts: [
      { key: 'night', label: 'Nacht', shade: 1 },
      { key: 'day', label: 'Tag', shade: 2 },
    ],
    read: (s) => ({ night: s.sleep.night, day: s.sleep.day }),
  },
  bottle: {
    label: 'Flasche',
    format: (v) => `${Math.round(v)} ml`,
    axis: (v) => `${Math.round(v)}`,
    step: 200,
    color: 'bottle',
    parts: [
      { key: 'breast', label: 'Muttermilch', shade: 1 },
      { key: 'formula', label: 'Pre-Milch', shade: 2 },
      { key: 'other', label: 'Andere', shade: 3 },
    ],
    read: (s) => ({ breast: s.bottle.breast, formula: s.bottle.formula, other: s.bottle.other }),
  },
  nursing: {
    label: 'Stillen',
    format: (v) => dur(v),
    axis: (v) => `${Math.round(v / MIN)} Min`,
    step: 30 * MIN,
    color: 'nursing',
    parts: [{ key: 'ms', label: 'Stillzeit', shade: 1 }],
    read: (s) => ({ ms: s.nursing.ms }),
  },
  diaper: {
    label: 'Windeln',
    format: (v) => `${Math.round(v * 10) / 10} Windeln`,
    axis: (v) => `${Math.round(v)}`,
    step: 2,
    color: 'diaper',
    parts: [{ key: 'total', label: 'Windeln', shade: 1 }],
    read: (s) => ({ total: s.diaper.total }),
  },
  pump: {
    label: 'Abpumpen',
    format: (v) => `${Math.round(v)} ml`,
    axis: (v) => `${Math.round(v)}`,
    step: 100,
    color: 'pump',
    parts: [{ key: 'ml', label: 'Abgepumpt', shade: 1 }],
    read: (s) => ({ ml: s.pump.ml }),
  },
  tummy: {
    label: 'Bauchzeit',
    format: (v) => dur(v),
    axis: (v) => `${Math.round(v / MIN)} Min`,
    step: 15 * MIN,
    color: 'pump',
    parts: [{ key: 'ms', label: 'Bauchzeit', shade: 1 }],
    read: (s) => ({ ms: s.activity.Bauchzeit ?? 0 }),
  },
};

/**
 * Daily series for one metric. The average only counts days with data, so a day
 * nobody logged never reads as a bad day.
 */
export function metricSeries(entries, now, days, metricKey) {
  const metric = METRICS[metricKey];
  const rows = statsRange(entries, now, days).map((s) => {
    const values = metric.read(s);
    const total = Object.values(values).reduce((sum, v) => sum + v, 0);
    return { day: s.day, values, total };
  });
  const filled = rows.filter((r) => r.total > 0);
  const average = filled.length ? filled.reduce((sum, r) => sum + r.total, 0) / filled.length : null;
  const max = rows.reduce((m, r) => Math.max(m, r.total), 0);
  return { rows, average, max, filledDays: filled.length };
}

/** Plain comparisons of this week with the one before. Facts without a verdict. */
export function insights(entries, now) {
  const today = startOfDay(now);
  const lastDays = statsRange(entries, now, 7);
  const prevDays = statsRange(entries, addDays(today, -7) + DAY / 2, 7);
  const out = [];

  const compare = (label, read, format, minChange) => {
    const avg = (rows) => {
      const values = rows.map(read).filter((v) => v > 0);
      return values.length >= 4 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };
    const a = avg(lastDays);
    const b = avg(prevDays);
    if (a === null || b === null) return;
    const diff = a - b;
    if (Math.abs(diff) < minChange) return;
    out.push(`${label}: im Schnitt ${format(Math.abs(diff))} ${diff > 0 ? 'mehr' : 'weniger'} pro Tag als in der Woche davor.`);
  };

  compare('Schlaf', (s) => s.sleep.total, dur, 20 * MIN);
  compare('Flasche', (s) => s.bottle.total, (v) => `${Math.round(v)} ml`, 40);
  compare('Stillen', (s) => s.nursing.ms, dur, 15 * MIN);
  compare('Bauchzeit', (s) => s.activity.Bauchzeit ?? 0, dur, 5 * MIN);
  return out.slice(0, 3);
}

export function lastByType(entries) {
  const last = {};
  for (const e of entries) {
    if (e.deletedAt) continue;
    const t = e.end ?? e.start;
    if (!last[e.type] || t > (last[e.type].end ?? last[e.type].start)) last[e.type] = e;
  }
  return last;
}

export function foodLog(entries) {
  const foods = new Map();
  const list = entries
    .filter((e) => e.type === 'solids' && !e.deletedAt)
    .sort((a, b) => a.start - b.start);
  for (const e of list) {
    for (const food of e.data?.foods ?? []) {
      const row = foods.get(food) ?? { food, first: e.start, last: e.start, times: 0, liked: null, reaction: null };
      row.times += 1;
      row.last = e.start;
      if (e.data?.liked) row.liked = e.data.liked;
      if (e.data?.reaction) row.reaction = e.data.reaction;
      foods.set(food, row);
    }
  }
  return [...foods.values()].sort((a, b) => b.last - a.last);
}

export function lastNursingSide(entries) {
  const last = entries
    .filter((e) => e.type === 'nursing' && !e.deletedAt)
    .sort((a, b) => (b.end ?? b.start) - (a.end ?? a.start))[0];
  return last?.data?.lastSide ?? null;
}

