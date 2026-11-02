// Pure timer logic. A timer is stored as timestamps, never as a counter, so it
// keeps running correctly through crashes, reloads and a locked phone.

export function wakeTotal(wakes, now) {
  return (wakes ?? []).reduce((sum, w) => sum + Math.max(0, (w.to ?? now) - w.from), 0);
}

export const isAwake = (timer) => (timer.wakes ?? []).some((w) => !w.to);

export function toggleWake(timer, now) {
  const wakes = (timer.wakes ?? []).map((w) => ({ ...w }));
  const open = wakes.find((w) => !w.to);
  if (open) open.to = now;
  else wakes.push({ from: now });
  return { ...timer, wakes };
}

export function closeWakes(wakes, end) {
  return (wakes ?? []).map((w) => ({ from: w.from, to: Math.min(w.to ?? end, end) }));
}

export const sleepElapsed = (timer, now) => now - timer.start - wakeTotal(timer.wakes, now);

export const emptyNursing = () => ({ sides: { left: 0, right: 0 }, active: null, since: null });

/** Tapping the running side pauses it, tapping the other side switches over. */
export function toggleSide(timer, side, now) {
  const sides = { ...timer.sides };
  if (timer.active) sides[timer.active] += now - timer.since;
  if (timer.active === side) return { ...timer, sides, active: null, since: null };
  return { ...timer, sides, active: side, since: now };
}

export function sideTotals(timer, now) {
  const sides = { ...timer.sides };
  if (timer.active) sides[timer.active] += now - timer.since;
  return { left: sides.left, right: sides.right, total: sides.left + sides.right };
}
