import { isDue } from '../core/ics.js';
import { ago, clock, stopwatch } from '../core/time.js';
import { esc } from './dom.js';
import { contraction } from './views/contraction.js';
import { history } from './views/history.js';
import { home } from './views/home.js';
import { log } from './views/log.js';
import { more } from './views/more.js';
import { onboarding } from './views/onboarding.js';
import { plan } from './views/plan.js';
import { report } from './views/report.js';
import { childEdit, childSwitch, reminders, settings } from './views/settings.js';

const ROUTES = [
  [/^#\/start$/, onboarding],
  [/^#\/heute$/, home],
  [/^#\/verlauf$/, history],
  [/^#\/mehr$/, more],
  [/^#\/log\/(\w+)$/, log],
  [/^#\/eintrag\/([\w-]+)$/, log],
  [/^#\/wehen$/, contraction],
  [/^#\/tagesplan$/, plan],
  [/^#\/bericht$/, report],
  [/^#\/einstellungen$/, settings],
  [/^#\/kinder$/, childSwitch],
  [/^#\/kind\/([\w-]+)(?:\?geboren)?$/, childEdit],
  [/^#\/erinnerungen$/, reminders],
];

const TOAST_MS = 7000;

export function startApp({ store, durable, setErrorHandler }) {
  const root = document.getElementById('root');
  const auraEl = document.getElementById('aura');
  const toastEl = document.getElementById('toast');
  const metaTheme = document.getElementById('theme-color');
  let view = null;
  let params = [];
  // Our own record of where the person came from, so a back button never leaves the app.
  const trail = [];
  let replacing = false;
  let toastTimer = null;
  let undoFn = null;

  const ctx = {
    store,
    durable,
    get state() { return store.state; },
    get child() { return store.activeChild(); },
    get params() { return params; },
    now: () => Date.now(),
    nav(hash) {
      if (location.hash === hash) route();
      else location.hash = hash;
    },
    /** Returns to the previous screen, and to Heute when there is none. */
    back(fallback = '#/heute') {
      if (trail.length > 1) window.history.back();
      else ctx.nav(fallback);
    },
    rerender: () => paint(false),
    toast,
  };

  function replaceHash(hash) {
    replacing = true;
    location.replace(hash);
  }

  function toast(message, undo = null, { error = false } = {}) {
    clearTimeout(toastTimer);
    undoFn = undo;
    toastEl.className = `toast${error ? ' is-error' : ''}`;
    toastEl.innerHTML = `<span>${esc(message)}</span>${undo ? '<button type="button" data-toast-undo>Rückgängig</button>' : ''}`;
    toastEl.hidden = false;
    toastTimer = setTimeout(() => { toastEl.hidden = true; undoFn = null; }, error ? TOAST_MS * 2 : TOAST_MS);
  }

  function applyTheme() {
    const { theme } = store.state.settings;
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    metaTheme.content = dark ? '#1B1412' : '#FEF8F3';
  }

  function focusKey(el) {
    if (!el || el === document.body || !root.contains(el)) return null;
    if (el.dataset.act) return `[data-act="${CSS.escape(el.dataset.act)}"][data-v="${CSS.escape(el.dataset.v ?? '')}"]`;
    return null;
  }

  function paint(entering) {
    if (!view) return;
    const key = focusKey(document.activeElement);
    const scroller = root.querySelector('.screen');
    const scrollTop = scroller?.scrollTop ?? 0;
    const aura = view.aura?.(ctx) ?? 'rest';
    auraEl.dataset.aura = aura;
    root.innerHTML = view.render(ctx);
    const screen = root.querySelector('.screen');
    if (entering) {
      screen?.classList.add('enter');
      const heading = root.querySelector('h1');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    } else {
      if (screen) screen.scrollTop = scrollTop;
      if (key) root.querySelector(key)?.focus({ preventScroll: true });
    }
    tick();
  }

  function route() {
    if (!location.hash || location.hash === '#' || location.hash === '#/') {
      replaceHash('#/heute');
      return;
    }
    const hasChild = store.liveChildren().length > 0;
    if (!hasChild && location.hash !== '#/start') {
      replaceHash('#/start');
      return;
    }
    if (hasChild && location.hash === '#/start' && !onboarding.isOpen?.()) {
      replaceHash('#/heute');
      return;
    }
    const match = ROUTES.find(([rx]) => rx.test(location.hash));
    if (!match) {
      replaceHash('#/heute');
      return;
    }
    params = match[0].exec(location.hash).slice(1);
    view = match[1];
    window.scrollTo(0, 0);
    view.enter?.(ctx);
    paint(true);
  }

  function tick() {
    const now = Date.now();
    root.querySelectorAll('[data-sw-since], [data-sw-base]').forEach((el) => {
      const base = Number(el.dataset.swBase ?? 0);
      const since = el.dataset.swSince ? Number(el.dataset.swSince) : null;
      el.textContent = stopwatch(base + (since ? now - since : 0));
    });
    root.querySelectorAll('[data-ago]').forEach((el) => {
      el.textContent = ago(Number(el.dataset.ago), now);
    });
    root.querySelectorAll('[data-live-clock]').forEach((el) => {
      el.textContent = clock(now);
    });
    view?.tick?.(ctx, root);
  }

  function checkReminders() {
    const now = Date.now();
    for (const reminder of store.liveReminders()) {
      if (!isDue(reminder, now)) continue;
      store.updateReminder(reminder.id, { firedAt: now });
      toast(`Erinnerung: ${reminder.title}`);
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('Flaum', { body: reminder.title, tag: reminder.id }); } catch { /* the toast above already told them */ }
      }
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-toast-undo]')) {
      undoFn?.();
      undoFn = null;
      toastEl.hidden = true;
      paint(false);
      return;
    }
    const backLink = event.target.closest('[data-back]');
    if (backLink) {
      event.preventDefault();
      ctx.back(backLink.getAttribute('href'));
      return;
    }
    const el = event.target.closest('[data-act]');
    if (!el || !root.contains(el) || !view) return;
    view.actions?.[el.dataset.act]?.(ctx, el, event);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const el = event.target.closest?.('[role="button"][data-act]');
    if (!el) return;
    event.preventDefault();
    view?.actions?.[el.dataset.act]?.(ctx, el, event);
  });

  root.addEventListener('input', (event) => view?.input?.(ctx, event.target, event));
  root.addEventListener('change', (event) => view?.change?.(ctx, event.target, event));

  window.addEventListener('hashchange', () => {
    const hash = location.hash;
    if (replacing) {
      trail[trail.length ? trail.length - 1 : 0] = hash;
      replacing = false;
    } else if (trail[trail.length - 2] === hash) {
      trail.pop();
    } else {
      trail.push(hash);
    }
    route();
  });

  // Another tab changed the data: read it again instead of overwriting it later.
  window.addEventListener('storage', () => { store.reload(); paint(false); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { paint(false); checkReminders(); } });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  store.subscribe(applyTheme);
  setErrorHandler(() => {
    toast('Der Speicher ist voll, der letzte Eintrag ist nicht gesichert. Sichere deine Daten in den Einstellungen und lösche alte Website-Daten.', null, { error: true });
  });

  applyTheme();
  trail.push(location.hash);
  route();
  if (store.recovered) toast('Der letzte Datenstand war beschädigt. Flaum hat die Sicherheitskopie geladen.');
  if (!durable) toast('Dieser Browser speichert nichts dauerhaft, zum Beispiel im privaten Modus. Öffne Flaum normal, damit Einträge bleiben.', null, { error: true });

  setInterval(tick, 1000);
  setInterval(checkReminders, 30_000);
  checkReminders();
}
