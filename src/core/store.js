import { HOME_DEFAULT, TRACKERS } from './catalog.js';

const KEY = 'flaum.v1';
const BACKUP_KEY = 'flaum.v1.bak';
const BACKUP_EVERY = 6 * 3600_000;
const MAX_NOTE = 2000;
const MAX_NAME = 80;
const FORMAT = 'flaum-sicherung';

export function emptyState() {
  return {
    v: 1,
    settings: {
      theme: 'auto',
      sleepHints: true,
      sleepShiftMin: 0,
      phone: '',
      phoneLabel: '',
      activeChildId: null,
      home: [...HOME_DEFAULT],
      customActivities: [],
    },
    children: [],
    entries: [],
    timers: [],
    reminders: [],
    demo: false,
    backupAt: 0,
  };
}

const str = (v, max = MAX_NAME) => (typeof v === 'string' ? v.slice(0, max) : '');
const isTime = (v) => Number.isFinite(v) && v > 0;
const isIsoOrNull = (v) => v === null || v === undefined || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const NUMERIC = ['ml', 'left', 'right', 'ms', 'celsius', 'weight', 'length', 'head'];
const TEXT_MAX = 200;

const cleanWakes = (wakes) =>
  (Array.isArray(wakes) ? wakes : [])
    .filter((w) => isPlainObject(w) && isTime(w.from) && (w.to === undefined || isTime(w.to)))
    .map((w) => (w.to ? { from: w.from, to: w.to } : { from: w.from }));

/** Entry details from a file are untrusted: numbers stay numbers, text stays short plain text. */
function cleanData(data) {
  if (!isPlainObject(data)) return {};
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (NUMERIC.includes(key)) {
      if (Number.isFinite(value) && value >= 0) out[key] = value;
    } else if (key === 'wakes') {
      out.wakes = cleanWakes(value);
    } else if (key === 'foods') {
      out.foods = (Array.isArray(value) ? value : []).filter((f) => typeof f === 'string').map((f) => f.slice(0, 60));
    } else if (typeof value === 'string') {
      out[key] = value.slice(0, TEXT_MAX);
    } else if (typeof value === 'boolean' || value === null) {
      out[key] = value;
    }
  }
  return out;
}

function cleanEntry(e) {
  if (!isPlainObject(e) || typeof e.id !== 'string' || typeof e.childId !== 'string') return null;
  if (!TRACKERS[e.type] || !isTime(e.start)) return null;
  if (e.end !== undefined && e.end !== null && !isTime(e.end)) return null;
  const out = {
    id: e.id.slice(0, 64),
    childId: e.childId.slice(0, 64),
    type: e.type,
    start: e.start,
    data: cleanData(e.data),
    createdAt: isTime(e.createdAt) ? e.createdAt : e.start,
    updatedAt: isTime(e.updatedAt) ? e.updatedAt : e.start,
  };
  if (e.end) out.end = e.end;
  if (typeof e.note === 'string' && e.note) out.note = e.note.slice(0, MAX_NOTE);
  if (isTime(e.deletedAt)) out.deletedAt = e.deletedAt;
  return out;
}

function cleanChild(c) {
  if (!isPlainObject(c) || typeof c.id !== 'string') return null;
  if (!isIsoOrNull(c.dueDate) || !isIsoOrNull(c.birthDate)) return null;
  const out = {
    id: c.id.slice(0, 64),
    name: str(c.name),
    phase: c.phase === 'expecting' ? 'expecting' : 'born',
    dueDate: c.dueDate ?? null,
    birthDate: c.birthDate ?? null,
    sex: c.sex === 'f' || c.sex === 'm' ? c.sex : null,
    updatedAt: isTime(c.updatedAt) ? c.updatedAt : 1,
  };
  if (isTime(c.deletedAt)) out.deletedAt = c.deletedAt;
  return out;
}

function cleanReminder(r) {
  if (!isPlainObject(r) || typeof r.id !== 'string') return null;
  const out = {
    id: r.id.slice(0, 64),
    title: str(r.title, 120),
    repeat: r.repeat === 'daily' ? 'daily' : 'once',
    hour: Number.isInteger(r.hour) ? r.hour : 8,
    minute: Number.isInteger(r.minute) ? r.minute : 0,
    enabled: r.enabled !== false,
    updatedAt: isTime(r.updatedAt) ? r.updatedAt : 1,
  };
  if (isTime(r.at)) out.at = r.at;
  if (isTime(r.firedAt)) out.firedAt = r.firedAt;
  if (isTime(r.deletedAt)) out.deletedAt = r.deletedAt;
  return out;
}

function cleanTimer(t) {
  if (!isPlainObject(t) || typeof t.id !== 'string' || typeof t.childId !== 'string') return null;
  if (!TRACKERS[t.type] || !isTime(t.start)) return null;
  const out = { id: t.id.slice(0, 64), childId: t.childId.slice(0, 64), type: t.type, start: t.start };
  if (Array.isArray(t.wakes)) out.wakes = cleanWakes(t.wakes);
  if (isPlainObject(t.sides)) {
    out.sides = { left: Number.isFinite(t.sides.left) ? t.sides.left : 0, right: Number.isFinite(t.sides.right) ? t.sides.right : 0 };
    out.active = t.active === 'left' || t.active === 'right' ? t.active : null;
    out.since = isTime(t.since) ? t.since : null;
    if (out.active && !out.since) out.active = null;
  }
  if (typeof t.kind === 'string') out.kind = t.kind.slice(0, 30);
  if (Number.isFinite(t.ml)) out.ml = t.ml;
  return out;
}

const cleanList = (list, fn) => (Array.isArray(list) ? list.map(fn).filter(Boolean) : []);

/** Accepts only known shapes, so a damaged or foreign file can never break the app. */
export function sanitize(raw) {
  if (!isPlainObject(raw)) throw new Error('kein gültiger Datenstand');
  const base = emptyState();
  const s = isPlainObject(raw.settings) ? raw.settings : {};
  return {
    ...base,
    settings: {
      ...base.settings,
      theme: ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto',
      sleepHints: s.sleepHints !== false,
      sleepShiftMin: Number.isFinite(s.sleepShiftMin) ? Math.max(-60, Math.min(60, s.sleepShiftMin)) : 0,
      phone: str(s.phone, 30),
      phoneLabel: str(s.phoneLabel, 40),
      activeChildId: typeof s.activeChildId === 'string' ? s.activeChildId : null,
      home: Array.isArray(s.home) ? s.home.filter((t) => TRACKERS[t]) : base.settings.home,
      customActivities: Array.isArray(s.customActivities) ? s.customActivities.map((a) => str(a, 30)).filter(Boolean) : [],
    },
    children: cleanList(raw.children, cleanChild),
    entries: cleanList(raw.entries, cleanEntry),
    timers: cleanList(raw.timers, cleanTimer),
    reminders: cleanList(raw.reminders, cleanReminder),
    demo: raw.demo === true,
    backupAt: isTime(raw.backupAt) ? raw.backupAt : 0,
  };
}

function mergeById(mine, theirs, idMap = new Map()) {
  const out = new Map(mine.map((x) => [x.id, x]));
  let added = 0;
  let updated = 0;
  for (const item of theirs) {
    const next = item.childId && idMap.has(item.childId) ? { ...item, childId: idMap.get(item.childId) } : item;
    const current = out.get(next.id);
    if (!current) {
      out.set(next.id, next);
      if (!next.deletedAt) added += 1;
    } else if ((next.updatedAt ?? 0) > (current.updatedAt ?? 0)) {
      out.set(next.id, next);
      updated += 1;
    }
  }
  return { list: [...out.values()], added, updated };
}

const sameChild = (a, b) =>
  a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
  (a.birthDate ?? a.dueDate) === (b.birthDate ?? b.dueDate);

/**
 * Merges a backup or a partner's file into this device: the newest change of each
 * entry wins and deletions travel along, so nothing is lost and nothing comes back.
 * Two phones that each created the same child end up with one child.
 */
export function mergeStates(mine, theirs) {
  const idMap = new Map();
  for (const child of theirs.children) {
    if (child.deletedAt || mine.children.some((c) => c.id === child.id)) continue;
    const twin = mine.children.find((c) => !c.deletedAt && sameChild(c, child));
    if (twin) idMap.set(child.id, twin.id);
  }
  const children = mergeById(mine.children, theirs.children.filter((c) => !idMap.has(c.id)));
  const entries = mergeById(mine.entries, theirs.entries, idMap);
  const reminders = mergeById(mine.reminders, theirs.reminders);

  const timers = [...mine.timers];
  for (const timer of theirs.timers) {
    const childId = idMap.get(timer.childId) ?? timer.childId;
    if (!timers.some((t) => t.id === timer.id || (t.childId === childId && t.type === timer.type))) {
      timers.push({ ...timer, childId });
    }
  }

  const wasEmpty = !mine.children.some((c) => !c.deletedAt);
  const settings = wasEmpty ? { ...mine.settings, ...theirs.settings } : mine.settings;
  if (!settings.activeChildId || !children.list.some((c) => c.id === settings.activeChildId)) {
    settings.activeChildId = children.list.find((c) => !c.deletedAt)?.id ?? null;
  }

  return {
    state: { ...mine, settings, children: children.list, entries: entries.list, reminders: reminders.list, timers },
    added: entries.added,
    updated: entries.updated,
  };
}

export function createStore({ storage, now = Date.now, id = () => crypto.randomUUID(), onError = () => {} }) {
  let state = emptyState();
  let recovered = false;
  const listeners = new Set();

  const read = (key) => {
    const text = storage.getItem(key);
    return text ? sanitize(JSON.parse(text)) : null;
  };

  function load() {
    recovered = false;
    try {
      state = read(KEY) ?? emptyState();
    } catch {
      try {
        const bak = read(BACKUP_KEY);
        if (bak) {
          state = bak;
          recovered = true;
        } else {
          state = emptyState();
        }
      } catch {
        state = emptyState();
      }
    }
  }

  function persist() {
    const t = now();
    let previous = null;
    if (t - state.backupAt > BACKUP_EVERY) {
      previous = storage.getItem(KEY);
      state.backupAt = t;
    }
    const text = JSON.stringify(state);
    try {
      if (previous) storage.setItem(BACKUP_KEY, previous);
      storage.setItem(KEY, text);
      return true;
    } catch {
      try {
        // The safety copy is the first thing to give up when storage runs full.
        storage.removeItem(BACKUP_KEY);
        storage.setItem(KEY, text);
        return true;
      } catch (error) {
        onError(error);
        return false;
      }
    }
  }

  function commit() {
    const ok = persist();
    listeners.forEach((fn) => fn(state));
    return ok;
  }

  load();

  const api = {
    get state() { return state; },
    get recovered() { return recovered; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    reload() { load(); listeners.forEach((fn) => fn(state)); },

    activeChild() {
      const live = state.children.filter((c) => !c.deletedAt);
      return live.find((c) => c.id === state.settings.activeChildId) ?? live[0] ?? null;
    },
    liveChildren() { return state.children.filter((c) => !c.deletedAt); },
    entriesFor(childId, types) {
      return state.entries.filter((e) => e.childId === childId && !e.deletedAt && (!types || types.includes(e.type)));
    },
    entry(entryId) { return state.entries.find((e) => e.id === entryId && !e.deletedAt) ?? null; },

    updateSettings(patch) {
      state.settings = { ...state.settings, ...patch };
      return commit();
    },
    addChild(fields) {
      const child = cleanChild({ id: id(), updatedAt: now(), ...fields });
      state.children.push(child);
      state.settings.activeChildId = child.id;
      commit();
      return child;
    },
    updateChild(childId, patch) {
      state.children = state.children.map((c) => (c.id === childId ? cleanChild({ ...c, ...patch, updatedAt: now() }) : c));
      return commit();
    },
    deleteChild(childId) {
      const t = now();
      state.children = state.children.map((c) => (c.id === childId ? { ...c, deletedAt: t, updatedAt: t } : c));
      state.entries = state.entries.map((e) => (e.childId === childId && !e.deletedAt ? { ...e, deletedAt: t, updatedAt: t } : e));
      state.timers = state.timers.filter((x) => x.childId !== childId);
      if (state.settings.activeChildId === childId) state.settings.activeChildId = api.liveChildren()[0]?.id ?? null;
      return commit();
    },
    setActiveChild(childId) { return api.updateSettings({ activeChildId: childId }); },

    addEntry(fields) {
      const t = now();
      const entry = cleanEntry({ id: id(), createdAt: t, updatedAt: t, ...fields });
      if (!entry) throw new Error('Eintrag ungültig');
      state.entries.push(entry);
      commit();
      return entry;
    },
    updateEntry(entryId, patch) {
      const before = state.entries.find((e) => e.id === entryId);
      if (!before) return null;
      const merged = { ...before, ...patch, updatedAt: now() };
      if (patch.end === null) delete merged.end;
      if (patch.note === '') delete merged.note;
      const next = cleanEntry(merged);
      if (!next) throw new Error('Eintrag ungültig');
      state.entries = state.entries.map((e) => (e.id === entryId ? next : e));
      commit();
      return before;
    },
    deleteEntry(entryId) {
      const t = now();
      state.entries = state.entries.map((e) => (e.id === entryId ? { ...e, deletedAt: t, updatedAt: t } : e));
      return commit();
    },
    restoreEntry(entry) {
      state.entries = state.entries.map((e) => (e.id === entry.id ? { ...entry, updatedAt: now() } : e));
      delete state.entries.find((e) => e.id === entry.id)?.deletedAt;
      return commit();
    },

    timerFor(childId, type) { return state.timers.find((t) => t.childId === childId && t.type === type) ?? null; },
    timersFor(childId) { return state.timers.filter((t) => t.childId === childId); },
    startTimer(childId, type, extra = {}) {
      const existing = api.timerFor(childId, type);
      if (existing) return existing;
      const timer = { id: id(), childId, type, start: now(), ...extra };
      state.timers.push(timer);
      commit();
      return timer;
    },
    setTimer(timer) {
      state.timers = state.timers.map((t) => (t.id === timer.id ? timer : t));
      return commit();
    },
    removeTimer(timerId) {
      state.timers = state.timers.filter((t) => t.id !== timerId);
      return commit();
    },
    restoreTimer(timer) {
      state.timers = state.timers.filter((t) => !(t.childId === timer.childId && t.type === timer.type));
      state.timers.push(timer);
      return commit();
    },

    addReminder(fields) {
      const reminder = cleanReminder({ id: id(), updatedAt: now(), ...fields });
      state.reminders.push(reminder);
      commit();
      return reminder;
    },
    updateReminder(reminderId, patch) {
      state.reminders = state.reminders.map((r) => (r.id === reminderId ? cleanReminder({ ...r, ...patch, updatedAt: now() }) : r));
      return commit();
    },
    deleteReminder(reminderId) {
      const t = now();
      state.reminders = state.reminders.map((r) => (r.id === reminderId ? { ...r, deletedAt: t, updatedAt: t } : r));
      return commit();
    },
    liveReminders() { return state.reminders.filter((r) => !r.deletedAt); },

    exportBackup() {
      return JSON.stringify({ format: FORMAT, exportedAt: now(), state });
    },
    importBackup(text) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Diese Datei lässt sich nicht lesen. Wähle eine Flaum-Sicherung mit der Endung .json.');
      }
      if (parsed?.format !== FORMAT || !isPlainObject(parsed.state)) {
        throw new Error('Diese Datei ist keine Flaum-Sicherung. Wähle eine Datei, die Flaum erstellt hat.');
      }
      const result = mergeStates(state, sanitize(parsed.state));
      state = result.state;
      commit();
      return { added: result.added, updated: result.updated };
    },
    replaceState(next) {
      state = sanitize(next);
      return commit();
    },
    reset() {
      state = emptyState();
      storage.removeItem(BACKUP_KEY);
      return commit();
    },
  };
  return api;
}

export function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    _data: data,
  };
}

export const STORAGE_KEYS = { KEY, BACKUP_KEY };
