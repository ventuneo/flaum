import { MIN } from './time.js';

const WINDOW = 60 * MIN;
const SESSION_GAP = 30 * MIN;
const CALL_INTERVAL = 6 * MIN;
const MIN_INTERVALS = 5;
const MAX_SCATTER = 0.35;
const STALE_AFTER = 15 * MIN;

const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

function scatter(values) {
  const avg = mean(values);
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance) / avg;
}

/**
 * Summary of the last hour. The interval is measured start to start, the
 * usual way midwives ask for it. Gaps over 30 minutes split the measurement
 * so that an early false alarm cannot distort the current pattern.
 */
export function summarize(contractions, now) {
  const finished = contractions
    .filter((c) => c.end && !c.deletedAt)
    .sort((a, b) => a.start - b.start);

  const recent = finished.filter((c) => c.start >= now - WINDOW);
  const intervals = [];
  for (let i = 1; i < recent.length; i += 1) {
    const gap = recent[i].start - recent[i - 1].start;
    if (gap <= SESSION_GAP) intervals.push(gap);
  }

  const durations = recent.map((c) => c.end - c.start);
  const avgInterval = intervals.length ? mean(intervals) : null;
  const avgDuration = durations.length ? mean(durations) : null;
  const regular = intervals.length >= MIN_INTERVALS && scatter(intervals) <= MAX_SCATTER;
  const last = recent[recent.length - 1] ?? null;
  const stale = !last || now - last.start > STALE_AFTER;

  return {
    count: recent.length,
    avgInterval,
    avgDuration,
    regular,
    callHint: regular && !stale && avgInterval <= CALL_INTERVAL,
    lastStart: finished.length ? finished[finished.length - 1].start : null,
  };
}

/** Interval to the previous contraction, null when it starts a new session. */
export function intervalBefore(contractions, entry) {
  const earlier = contractions
    .filter((c) => !c.deletedAt && c.start < entry.start)
    .sort((a, b) => b.start - a.start)[0];
  if (!earlier) return null;
  const gap = entry.start - earlier.start;
  return gap <= SESSION_GAP ? gap : null;
}
