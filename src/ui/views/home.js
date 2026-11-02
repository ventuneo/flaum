import { EXPECTING_TRACKERS, MOODS, TRACKERS, label } from '../../core/catalog.js';
import { gestation } from '../../core/pregnancy.js';
import { lastByType } from '../../core/reports.js';
import { predictNextSleep } from '../../core/sleep.js';
import { ageLabel, clock, dateShort, fromIso, stopwatch, weekday } from '../../core/time.js';
import { isAwake, sideTotals, sleepElapsed, wakeTotal } from '../../core/timers.js';
import { esc, icon, pillNav } from '../dom.js';

const timerRoute = (type) => (type === 'contraction' ? '#/wehen' : `#/log/${type}`);

function swAttrs(timer, now) {
  if (timer.type === 'sleep') {
    if (isAwake(timer)) return `data-sw-base="${sleepElapsed(timer, now)}"`;
    return `data-sw-base="${-wakeTotal(timer.wakes, now)}" data-sw-since="${timer.start}"`;
  }
  if (timer.type === 'nursing') {
    const closed = (timer.sides?.left ?? 0) + (timer.sides?.right ?? 0);
    return timer.active ? `data-sw-base="${closed}" data-sw-since="${timer.since}"` : `data-sw-base="${closed}"`;
  }
  return `data-sw-since="${timer.start}"`;
}

function timerValue(timer, now) {
  if (timer.type === 'sleep') return sleepElapsed(timer, now);
  if (timer.type === 'nursing') return sideTotals(timer, now).total;
  return now - timer.start;
}

function bornStage(ctx, child, entries, timers) {
  const now = ctx.now();
  const sleeping = timers.find((t) => t.type === 'sleep');
  const others = timers.filter((t) => t.type !== 'sleep');
  const running = others.map((t) => `<a class="running" href="${timerRoute(t.type)}">${esc(TRACKERS[t.type].label)} <b ${swAttrs(t, now)}>${stopwatch(timerValue(t, now))}</b></a>`).join('');

  if (sleeping) {
    const awake = isAwake(sleeping);
    return `
      <a class="stage stage--link" href="#/log/sleep">
        <p class="kicker">${awake ? 'Kurz wach' : 'Schläft'} seit ${clock(sleeping.start)}</p>
        <h1 class="word word--clock" ${swAttrs(sleeping, now)}>${stopwatch(sleepElapsed(sleeping, now))}</h1>
      </a>
      ${running ? `<div class="running-row">${running}</div>` : ''}`;
  }

  const sleeps = entries.filter((e) => e.type === 'sleep');
  const lastSleep = lastByType(sleeps).sleep;
  let hint = '';
  if (ctx.state.settings.sleepHints) {
    const p = predictNextSleep({ sleeps, child, now, shiftMin: ctx.state.settings.sleepShiftMin });
    if (p.status === 'ok') {
      // Once the window has passed the hint says nothing about it: no reminder of a "missed" nap.
      const text = now > p.to ? 'Tagesplan ansehen' : `Nächster Schlaf etwa ${clock(p.from)} bis ${clock(p.to)}`;
      hint = `<a class="hint" href="#/tagesplan">${esc(text)}</a>`;
    } else if (p.status !== 'unknown' && p.status !== 'young') {
      hint = '<a class="hint" href="#/tagesplan">Tagesplan ansehen</a>';
    }
  }

  const word = lastSleep ? 'Wach' : esc(child.name);
  const sub = lastSleep
    ? `seit <span data-ago-short="${lastSleep.end}">${agoShort(lastSleep.end, now)}</span>`
    : esc(child.birthDate ? ageLabel(child.birthDate, now) : '');
  return `
    <div class="stage">
      <h1 class="word">${word}</h1>
      <p class="sub">${sub}</p>
      ${hint}
    </div>
    ${running ? `<div class="running-row">${running}</div>` : ''}`;
}

const agoShort = (ts, now) => {
  const minutes = Math.max(0, Math.round((now - ts) / 60000));
  if (minutes < 60) return `${minutes} Min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} Std ${m} Min` : `${h} Std`;
};

function tileFor(ctx, type, last, timer) {
  const def = TRACKERS[type];
  const now = ctx.now();
  let detail;
  if (timer) {
    detail = `<b class="tile-live" ${swAttrs(timer, now)}>${stopwatch(timerValue(timer, now))}</b>`;
  } else if (last) {
    detail = `<span data-ago="${last.end ?? last.start}"></span>`;
  } else {
    detail = '<span>Noch nichts</span>';
  }
  return `
    <a class="tile t-${def.tint}" href="${timerRoute(type)}">
      <strong>${esc(def.label)}</strong>
      <small>${detail}</small>
    </a>`;
}

function renderExpecting(ctx, child) {
  const now = ctx.now();
  const g = gestation(child.dueDate, now);
  const entries = ctx.store.entriesFor(child.id);
  const last = lastByType(entries);
  const timers = ctx.store.timersFor(child.id);
  const moodToday = last.mood ? label(MOODS, last.mood.data.mood) : null;
  const leftText = !g
    ? `Termin am ${dateShort(fromIso(child.dueDate))}`
    : g.overdue
      ? `${Math.abs(g.daysLeft)} ${Math.abs(g.daysLeft) === 1 ? 'Tag' : 'Tage'} über dem Termin`
      : g.daysLeft === 0
        ? 'Heute ist der Termin'
        : `Noch ${g.daysLeft} ${g.daysLeft === 1 ? 'Tag' : 'Tage'} bis zum Termin`;
  const pct = g ? Math.round(g.progress * 100) : 0;
  const running = timers.find((t) => t.type === 'contraction');
  return `
    <section class="screen home">
      <header class="bar">
        <a class="glass glass--text" href="#/kinder" aria-label="${esc(child.name)}, wechseln oder bearbeiten">${esc(child.name.charAt(0).toUpperCase())}</a>
        <div class="bar-title">
          <span>${esc(weekday(now))}, ${esc(dateShort(now))}</span>
          <div class="progress" role="progressbar" aria-label="Schwangerschaft zu ${pct} Prozent" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
        </div>
        <a class="glass" href="#/einstellungen" aria-label="Einstellungen">${icon.gear}</a>
      </header>
      <div class="stage">
        <h1 class="word word--big">${esc(g ? g.label : child.name)}</h1>
        <p class="sub">${esc(leftText)}</p>
      </div>
      <div class="sheet">
        <div class="tiles">
          ${EXPECTING_TRACKERS.slice(0, 2).map((t) => tileFor(ctx, t, last[t], running && t === 'contraction' ? running : null)).join('')}
          ${tileFor(ctx, 'note', last.note, null)}
          <a class="tile t-sky" href="#/kind/${esc(child.id)}?geboren">
            <strong>Baby ist da</strong>
            <small><span>Zur Babyzeit wechseln</span></small>
          </a>
        </div>
        ${moodToday ? `<p class="sheet-line">Zuletzt: ${esc(moodToday)}, <span data-ago="${last.mood.start}"></span></p>` : ''}
        ${pillNav('heute')}
      </div>
    </section>`;
}

function renderBorn(ctx, child) {
  const now = ctx.now();
  const entries = ctx.store.entriesFor(child.id);
  const timers = ctx.store.timersFor(child.id);
  const last = lastByType(entries);
  const types = ctx.state.settings.home.filter((t) => TRACKERS[t]);
  const tiles = types.map((t) => tileFor(ctx, t, last[t], timers.find((x) => x.type === t))).join('');
  return `
    <section class="screen home">
      <header class="bar">
        <a class="glass glass--text" href="#/kinder" aria-label="${esc(child.name)}, wechseln oder bearbeiten">${esc(child.name.charAt(0).toUpperCase())}</a>
        <div class="bar-title">
          <span>${esc(weekday(now))}, ${esc(dateShort(now))}</span>
          <strong>${esc(child.name)}</strong>
        </div>
        <a class="glass" href="#/einstellungen" aria-label="Einstellungen">${icon.gear}</a>
      </header>
      ${bornStage(ctx, child, entries, timers)}
      <div class="sheet">
        <div class="tiles">${tiles}</div>
        <a class="more-row" href="#/mehr">Mehr festhalten</a>
        ${pillNav('heute')}
      </div>
    </section>`;
}

export const home = {
  aura(ctx) {
    const child = ctx.child;
    if (!child || child.phase === 'expecting') return 'rest';
    if (ctx.store.timerFor(child.id, 'sleep')) return 'sleep';
    return 'rest';
  },
  render(ctx) {
    const child = ctx.child;
    return child.phase === 'expecting' ? renderExpecting(ctx, child) : renderBorn(ctx, child);
  },
  tick(ctx, root) {
    const now = ctx.now();
    root.querySelectorAll('[data-ago-short]').forEach((el) => {
      el.textContent = agoShort(Number(el.dataset.agoShort), now);
    });
  },
};

