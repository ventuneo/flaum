import { ACTIVITIES, BOTTLE_KINDS, DIAPER_KINDS, FOODS, INTENSITIES, LIKES, MILESTONES, MOODS, POTTY_KINDS, REACTIONS, SIDES, STOOL_COLORS, TRACKERS, label } from '../../core/catalog.js';
import { describe } from '../../core/describe.js';
import { foodLog, lastByType, lastNursingSide } from '../../core/reports.js';
import { correctedAgeDays } from '../../core/sleep.js';
import { HOUR, MIN, clock, dateShort, dayWord, dur, durSeconds, fromIso, isoDate, stopwatch, weekday } from '../../core/time.js';
import { closeWakes, emptyNursing, isAwake, sideTotals, sleepElapsed, toggleSide, toggleWake, wakeTotal } from '../../core/timers.js';
import { chip, chips, esc, go, icon } from '../dom.js';

let d = null;

const asTint = (name) => ({ label: name, key: name, tint: 'sand' });

// ---------- shared pieces ----------

function whenBlock(ctx, field, title, { live = false, dateOnly = false } = {}) {
  const now = ctx.now();
  const ts = d.t[field];
  const open = d.open === field;
  const value = ts === null ? 'Jetzt' : dateOnly ? dayWord(ts, now) : `${dayWord(ts, now)}, ${clock(ts)}`;
  const quick = [['Jetzt', 0], ['−5 Min', 5], ['−15 Min', 15], ['−30 Min', 30], ['−1 Std', 60]];
  const panel = !open ? '' : `
    <div class="when-panel">
      ${dateOnly ? '' : `
        <div class="chips chips--small">
          ${quick.map(([text, minutes]) => chip(text, { act: 't-shift', value: `${field}:${minutes}`, tint: 'sand' })).join('')}
        </div>
        <div class="time-inputs">
          <input class="num" inputmode="numeric" pattern="[0-9]*" maxlength="2" aria-label="Stunde" value="${String(new Date(ts ?? now).getHours()).padStart(2, '0')}" data-time="hh" data-field="${field}">
          <span aria-hidden="true">:</span>
          <input class="num" inputmode="numeric" pattern="[0-9]*" maxlength="2" aria-label="Minute" value="${String(new Date(ts ?? now).getMinutes()).padStart(2, '0')}" data-time="mm" data-field="${field}">
        </div>`}
      <label class="field field--inline">
        <span>Tag</span>
        <input type="date" value="${isoDate(ts ?? now)}" max="${isoDate(now)}" data-time="day" data-field="${field}">
      </label>
    </div>`;
  return `
    <div class="when">
      <button type="button" class="when-row" data-act="t-open" data-v="${field}" aria-expanded="${open}">
        <span>${esc(title)}</span>
        <strong>${esc(value)}</strong>
        <i class="${open ? 'is-open' : ''}">${icon.down}</i>
      </button>
      ${panel}
    </div>`;
}

const stepper = (text, down, up) => `
  <div class="stepper">
    <button type="button" class="round" data-act="step" data-v="${down}" aria-label="Weniger">${icon.minus}</button>
    <span class="stepper-value">${esc(text)}</span>
    <button type="button" class="round" data-act="step" data-v="${up}" aria-label="Mehr">${icon.plus}</button>
  </div>`;

function noteBlock() {
  if (!d.noteOpen && !d.note) {
    return '<button type="button" class="link" data-act="note-open" data-v="">Notiz hinzufügen</button>';
  }
  return `
    <label class="field">
      <span>Notiz</span>
      <textarea rows="2" maxlength="2000" data-bind="note">${esc(d.note)}</textarea>
    </label>`;
}

const moreLink = (text) => (d.more ? '' : `<button type="button" class="link" data-act="more" data-v="">${esc(text)}</button>`);

function minuteChips(selectedMs) {
  return `<div class="chips chips--small">${[5, 10, 15, 30].map((m) => chip(`${m} Min`, {
    act: 'ms',
    value: String(m * MIN),
    tint: 'sand',
    pressed: selectedMs === m * MIN,
  })).join('')}</div>`;
}

function timerBlock(ctx, type) {
  const timer = ctx.store.timerFor(ctx.child.id, type);
  if (timer) {
    return `
      <div class="chips">
        ${chip('Timer verwerfen', { act: 'timer-drop', tint: 'sand' })}
      </div>`;
  }
  if (d.entryId) return '';
  return `<div class="chips">${chip('Timer starten', { act: 'timer-start', tint: 'mint' })}</div>`;
}

// ---------- forms ----------

const FORMS = {
  sleep: {
    init(ctx, entry) {
      const now = ctx.now();
      if (entry) return { t: { start: entry.start, end: entry.end }, wakes: entry.data.wakes ?? [], manual: true };
      return { t: { start: now - 30 * MIN, end: now }, wakes: [], manual: false };
    },
    view(ctx) {
      const now = ctx.now();
      const timer = ctx.store.timerFor(ctx.child.id, 'sleep');
      if (timer && !d.entryId) {
        const awake = isAwake(timer);
        d.t.start = timer.start;
        if (!d.endEdited) d.t.end = null;
        const wakes = timer.wakes?.length ?? 0;
        return {
          word: `<span ${awake ? `data-sw-base="${sleepElapsed(timer, now)}"` : `data-sw-base="${-wakeTotal(timer.wakes, now)}" data-sw-since="${timer.start}"`}>${stopwatch(sleepElapsed(timer, now))}</span>`,
          wordClass: 'word--clock',
          sub: awake ? 'Kurz wach, die Zeit steht' : `Schläft seit ${clock(timer.start)}`,
          body: `
            <div class="chips">
              ${chip(awake ? 'Schläft wieder' : 'Kurz wach', { act: 'wake', tint: 'peri', pressed: awake })}
            </div>
            ${wakes ? `<p class="sheet-line">${wakes}-mal kurz wach</p>` : ''}
            ${whenBlock(ctx, 'start', 'Eingeschlafen')}
            ${whenBlock(ctx, 'end', 'Aufgewacht')}
            <button type="button" class="link" data-act="timer-drop">Timer verwerfen</button>`,
          primary: go('Aufgewacht', { act: 'sleep-stop' }),
        };
      }
      if (d.manual) {
        const net = d.t.end && d.t.end > d.t.start ? d.t.end - d.t.start - d.wakes.reduce((s, w) => s + (w.to - w.from), 0) : null;
        return {
          word: net === null ? 'Schlaf' : esc(dur(net)),
          sub: d.wakes.length ? `${d.wakes.length}-mal kurz wach` : '',
          body: `
            ${whenBlock(ctx, 'start', 'Eingeschlafen')}
            ${whenBlock(ctx, 'end', 'Aufgewacht')}
            ${noteBlock()}
            ${d.entryId && !timer ? '<button type="button" class="link" data-act="sleep-resume">Aus Versehen beendet? Weiterlaufen lassen</button>' : ''}`,
          primary: go('Speichern', { act: 'save' }),
        };
      }
      return {
        word: 'Schlaf',
        sub: `Tippe, sobald ${ctx.child.name} eingeschlafen ist.`,
        body: '<button type="button" class="link" data-act="sleep-manual">Schon vorbei? Zeiten eintragen</button>',
        primary: go('Schlaf starten', { act: 'sleep-start' }),
      };
    },
    build: () => ({
      start: d.t.start,
      end: d.t.end,
      data: { wakes: d.wakes.filter((w) => w.from >= d.t.start && w.to <= d.t.end) },
    }),
    validate: () => null,
  },

  nursing: {
    init(ctx, entry) {
      if (entry) {
        return { t: { start: entry.start }, left: entry.data.left ?? 0, right: entry.data.right ?? 0, manual: true };
      }
      return { t: { start: ctx.now() }, left: 0, right: 0, manual: false };
    },
    view(ctx) {
      const now = ctx.now();
      const child = ctx.child;
      const timer = ctx.store.timerFor(child.id, 'nursing');
      if (d.manual && !timer) {
        const total = d.left + d.right;
        return {
          word: esc(total ? dur(total) : 'Stillen'),
          body: `
            <p class="ask ask--small">Links</p>
            ${stepper(`${Math.round(d.left / MIN)} Min`, 'left:-1', 'left:1')}
            <p class="ask ask--small">Rechts</p>
            ${stepper(`${Math.round(d.right / MIN)} Min`, 'right:-1', 'right:1')}
            ${whenBlock(ctx, 'start', 'Beginn')}
            ${noteBlock()}`,
          primary: go('Speichern', { act: 'save' }),
        };
      }
      const totals = timer ? sideTotals(timer, now) : { left: 0, right: 0, total: 0 };
      const lastSide = lastNursingSide(ctx.store.entriesFor(child.id, ['nursing']));
      const side = (key, text) => {
        const active = timer?.active === key;
        const base = timer?.sides?.[key] ?? 0;
        return `
          <button type="button" class="side${active ? ' is-on' : ''} t-${key === 'left' ? 'rose' : 'sky'}" data-act="side" data-v="${key}" aria-pressed="${active}">
            <span>${text}</span>
            <b ${active ? `data-sw-base="${base}" data-sw-since="${timer.since}"` : `data-sw-base="${base}"`}>${stopwatch(totals[key])}</b>
            <small>${active ? 'Läuft' : lastSide === key ? 'Zuletzt hier' : '&nbsp;'}</small>
          </button>`;
      };
      const closed = (timer?.sides?.left ?? 0) + (timer?.sides?.right ?? 0);
      const wordAttrs = timer?.active ? `data-sw-base="${closed}" data-sw-since="${timer.since}"` : `data-sw-base="${closed}"`;
      return {
        word: `<span ${wordAttrs}>${stopwatch(totals.total)}</span>`,
        wordClass: 'word--clock',
        sub: !timer ? 'Tippe auf die Seite, an der du beginnst.' : timer.active ? '' : 'Pausiert',
        body: `
          <div class="sides">${side('left', 'Links')}${side('right', 'Rechts')}</div>
          ${timer ? '<button type="button" class="link" data-act="timer-drop">Timer verwerfen</button>' : '<button type="button" class="link" data-act="nursing-manual">Minuten eintragen</button>'}`,
        primary: timer ? go('Speichern', { act: 'nursing-save' }) : '',
      };
    },
    build() {
      const lastSide = d.right && !d.left ? 'right' : 'left';
      return {
        start: d.t.start,
        end: d.t.start + d.left + d.right,
        data: { left: d.left, right: d.right, lastSide },
      };
    },
    validate: () => (d.left + d.right > 0 ? null : 'Trag mindestens eine Minute ein.'),
  },

  bottle: {
    init(ctx, entry) {
      if (entry) return { t: { start: entry.start }, ml: entry.data.ml, kind: entry.data.kind ?? 'other' };
      const last = lastByType(ctx.store.entriesFor(ctx.child.id, ['bottle'])).bottle;
      return { t: { start: ctx.now() }, ml: last?.data.ml ?? 120, kind: last?.data.kind ?? 'breast' };
    },
    view(ctx) {
      return {
        word: esc(`${d.ml} ml`),
        body: `
          ${stepper('± 10 ml', 'ml:-10', 'ml:10')}
          <div class="chips chips--small">${[90, 120, 150, 180].map((v) => chip(`${v} ml`, { act: 'set-ml', value: String(v), tint: 'sky', pressed: d.ml === v })).join('')}</div>
          ${chips(BOTTLE_KINDS, { act: 'kind', selected: d.kind })}
          ${whenBlock(ctx, 'start', 'Wann')}
          ${noteBlock()}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build: () => ({ start: d.t.start, data: { ml: d.ml, kind: d.kind } }),
    validate: () => (d.ml > 0 ? null : 'Trag eine Menge über 0 ml ein.'),
  },

  diaper: {
    init(ctx, entry) {
      if (entry) return { t: { start: entry.start }, mode: entry.data.mode ?? 'diaper', kind: entry.data.kind, color: entry.data.color ?? null, more: !!entry.data.color };
      return { t: { start: ctx.now() }, mode: 'diaper', kind: 'wet', color: null };
    },
    view(ctx) {
      const potty = d.mode === 'potty';
      const list = potty ? POTTY_KINDS : DIAPER_KINDS;
      const showColor = d.kind === 'dirty' || d.kind === 'both';
      return {
        word: esc(label(list, d.kind)),
        ask: potty ? 'Was war auf dem Töpfchen?' : 'Was war in der Windel?',
        body: `
          ${chips(list, { act: 'kind', selected: d.kind })}
          ${whenBlock(ctx, 'start', 'Wann')}
          ${d.more ? `
            ${showColor ? `<p class="ask ask--small">Farbe, freiwillig</p>${chips(STOOL_COLORS, { act: 'color', selected: d.color })}` : ''}
            <div class="chips chips--small">${[['diaper', 'Windel'], ['potty', 'Töpfchen']].map(([k, t]) => chip(t, { act: 'mode', value: k, tint: 'sand', pressed: d.mode === k })).join('')}</div>
            ${noteBlock()}` : moreLink('Mehr Details')}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build: () => {
      const data = { mode: d.mode, kind: d.kind };
      if (d.color && (d.kind === 'dirty' || d.kind === 'both')) data.color = d.color;
      return { start: d.t.start, data };
    },
    validate: () => null,
  },

  pump: {
    init(ctx, entry) {
      if (entry) return { t: { start: entry.start }, ml: entry.data.ml ?? 0, side: entry.data.side ?? 'both', ms: entry.data.ms ?? 0 };
      const last = lastByType(ctx.store.entriesFor(ctx.child.id, ['pump'])).pump;
      return { t: { start: ctx.now() }, ml: last?.data.ml ?? 80, side: last?.data.side ?? 'both', ms: 0 };
    },
    view(ctx) {
      const now = ctx.now();
      const timer = ctx.store.timerFor(ctx.child.id, 'pump');
      return {
        word: timer ? `<span data-sw-since="${timer.start}">${stopwatch(now - timer.start)}</span>` : esc(`${d.ml} ml`),
        wordClass: timer ? 'word--clock' : '',
        sub: timer ? `Pumpst seit ${clock(timer.start)}, ${d.ml} ml` : '',
        body: `
          ${stepper('± 10 ml', 'ml:-10', 'ml:10')}
          ${chips(SIDES, { act: 'side-pick', selected: d.side })}
          ${timerBlock(ctx, 'pump')}
          ${timer ? '' : `${whenBlock(ctx, 'start', 'Wann')}${d.more ? `<p class="ask ask--small">Dauer, freiwillig</p>${minuteChips(d.ms)}${noteBlock()}` : moreLink('Mehr Details')}`}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build(ctx) {
      const timer = ctx.store.timerFor(ctx.child.id, 'pump');
      if (timer && !d.entryId) {
        return { start: timer.start, data: { ml: d.ml, side: d.side, ms: ctx.now() - timer.start }, removeTimer: timer.id };
      }
      return { start: d.t.start, data: { ml: d.ml, side: d.side, ms: d.ms } };
    },
    validate: () => null,
  },

  solids: {
    init(ctx, entry) {
      if (entry) {
        return {
          t: { start: entry.start },
          foods: [...(entry.data.foods ?? [])],
          liked: entry.data.liked ?? null,
          reaction: entry.data.reaction ?? null,
          query: '',
          more: !!(entry.data.liked || entry.data.reaction),
        };
      }
      return { t: { start: ctx.now() }, foods: [], liked: null, reaction: null, query: '' };
    },
    view(ctx) {
      const tried = new Set(foodLog(ctx.store.entriesFor(ctx.child.id, ['solids'])).map((f) => f.food));
      const firstTime = d.foods.filter((f) => !tried.has(f));
      const lastFood = FOODS.find((f) => f.name === d.foods[d.foods.length - 1]);
      return {
        word: esc(d.foods.length ? d.foods.join(', ') : 'Beikost'),
        wordClass: d.foods.length > 2 ? 'word--small' : '',
        sub: firstTime.length ? `Zum ersten Mal: ${firstTime.join(', ')}` : '',
        ask: 'Was gab es? Das ist freiwillig.',
        body: `
          <label class="field">
            <span class="sr-only">Lebensmittel suchen</span>
            <input type="search" placeholder="Suchen oder eintippen" data-food-search value="${esc(d.query)}" autocomplete="off">
          </label>
          <div id="food-results">${foodResults(ctx)}</div>
          ${lastFood?.tip ? `<p class="tip">${esc(lastFood.tip)}</p>` : ''}
          ${whenBlock(ctx, 'start', 'Wann')}
          ${d.more ? `
            <p class="ask ask--small">Wie war es?</p>
            ${chips(LIKES, { act: 'liked', selected: d.liked })}
            <p class="ask ask--small">Reaktion, falls es eine gab</p>
            ${chips(REACTIONS.map(asTint), { act: 'reaction', selected: d.reaction })}
            ${d.reaction === 'Atemprobleme' ? '<p class="tip tip--strong">Bei Atemproblemen sofort 144 anrufen.</p>' : ''}
            ${noteBlock()}` : moreLink('Mehr Details')}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build: () => {
      const data = { foods: d.foods };
      if (d.liked) data.liked = d.liked;
      if (d.reaction) data.reaction = d.reaction;
      return { start: d.t.start, data };
    },
    validate: () => null,
  },

  growth: {
    init(ctx, entry) {
      const data = entry?.data ?? {};
      return { t: { start: entry?.start ?? ctx.now() }, weight: data.weight ?? '', length: data.length ?? '', head: data.head ?? '' };
    },
    view(ctx) {
      const input = (key, text, unit, step) => `
        <label class="field field--unit">
          <span>${text}</span>
          <input type="text" inputmode="decimal" data-bind="${key}" value="${esc(d[key])}" data-step="${step}">
          <em>${unit}</em>
        </label>`;
      return {
        word: 'Wachstum',
        sub: 'Trag ein, was du gemessen hast.',
        body: `
          ${input('weight', 'Gewicht', 'kg')}
          ${input('length', 'Länge', 'cm')}
          ${input('head', 'Kopfumfang', 'cm')}
          ${whenBlock(ctx, 'start', 'Datum', { dateOnly: true })}
          ${noteBlock()}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build: () => {
      const data = {};
      for (const key of ['weight', 'length', 'head']) {
        const value = Number(String(d[key]).replace(',', '.'));
        if (value > 0) data[key] = value;
      }
      return { start: d.t.start, data };
    },
    validate: () => {
      const values = ['weight', 'length', 'head'].map((k) => String(d[k]).trim()).filter(Boolean);
      if (!values.length) return 'Trag mindestens einen Wert ein.';
      if (values.some((v) => !(Number(v.replace(',', '.')) > 0))) return 'Trag die Werte als Zahl ein, zum Beispiel 6,4.';
      return null;
    },
  },

  milestone: {
    init(ctx, entry) {
      return { t: { start: entry?.start ?? ctx.now() }, name: entry?.data.name ?? '', custom: '' };
    },
    view(ctx) {
      const reached = new Set(ctx.store.entriesFor(ctx.child.id, ['milestone']).map((e) => e.data.name));
      const all = MILESTONES.filter((m) => !reached.has(m) || m === d.name);
      const open = d.more ? all : all.slice(0, 6);
      return {
        word: esc(d.name || d.custom || 'Meilenstein'),
        ask: 'Was ist heute neu?',
        body: `
          <div class="chips">${open.map((m) => chip(m, { act: 'milestone', value: m, tint: 'butter', pressed: d.name === m })).join('')}</div>
          ${all.length > open.length ? moreLink('Weitere anzeigen') : ''}
          <label class="field">
            <span>Oder in eigenen Worten</span>
            <input type="text" maxlength="60" data-bind="custom" data-word value="${esc(d.custom)}" autocomplete="off">
          </label>
          ${whenBlock(ctx, 'start', 'Datum', { dateOnly: true })}
          ${noteBlock()}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build: () => ({ start: d.t.start, data: { name: d.custom.trim() || d.name } }),
    validate: () => (d.custom.trim() || d.name ? null : 'Wähle einen Meilenstein oder schreib ihn auf.'),
  },

  medicine: {
    init(ctx, entry) {
      return { t: { start: entry?.start ?? ctx.now() }, name: entry?.data.name ?? '', dose: entry?.data.dose ?? '', remind: 0 };
    },
    view(ctx) {
      const recents = [...new Set(ctx.store.entriesFor(ctx.child.id, ['medicine']).sort((a, b) => b.start - a.start).map((e) => e.data.name))].slice(0, 5);
      return {
        word: esc(d.name || 'Medizin'),
        body: `
          ${recents.length ? `<div class="chips chips--small">${recents.map((n) => chip(n, { act: 'med-name', value: n, tint: 'lilac', pressed: d.name === n })).join('')}</div>` : ''}
          <label class="field"><span>Was?</span><input type="text" maxlength="60" data-bind="name" data-word value="${esc(d.name)}" autocomplete="off"></label>
          <label class="field"><span>Wie viel?</span><input type="text" maxlength="40" data-bind="dose" value="${esc(d.dose)}" autocomplete="off"></label>
          ${whenBlock(ctx, 'start', 'Wann')}
          ${d.entryId ? '' : `
            <p class="ask ask--small">Erinnern?</p>
            <div class="chips chips--small">${[[0, 'Nein'], [4, 'In 4 Std'], [6, 'In 6 Std'], [8, 'In 8 Std']].map(([h, t]) => chip(t, { act: 'remind', value: String(h), tint: 'lilac', pressed: d.remind === h })).join('')}</div>`}
          ${noteBlock()}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build: () => ({ start: d.t.start, data: { name: d.name.trim(), dose: d.dose.trim() } }),
    validate: () => (d.name.trim() ? null : 'Trag ein, welche Medizin es war.'),
    after(ctx, entry) {
      if (d.remind) {
        ctx.store.addReminder({
          title: `${ctx.child.name}: ${entry.data.name}`,
          at: entry.start + d.remind * HOUR,
          repeat: 'once',
        });
      }
    },
  },

  temperature: {
    init(ctx, entry) {
      return { t: { start: entry?.start ?? ctx.now() }, celsius: entry?.data.celsius ?? 37 };
    },
    view(ctx) {
      const age = correctedAgeDays(ctx.child, ctx.now());
      const fever = d.celsius >= 38;
      const text = String(d.celsius.toFixed(1)).replace('.', ',');
      return {
        word: esc(`${text} °C`),
        body: `
          ${stepper('± 0,1 °C', 'c:-0.1', 'c:0.1')}
          ${fever ? `<p class="tip tip--strong">${age !== null && age < 90
            ? 'Unter 3 Monaten: Ruf bei 38 °C oder mehr gleich die Kinderärztin, den Kinderarzt oder den Notfalldienst an.'
            : 'Wenn dir etwas Sorgen macht, ruf die Kinderarztpraxis oder den Notfalldienst an.'}</p>` : ''}
          ${whenBlock(ctx, 'start', 'Wann')}
          ${noteBlock()}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build: () => ({ start: d.t.start, data: { celsius: Math.round(d.celsius * 10) / 10 } }),
    validate: () => null,
  },

  activity: {
    init(ctx, entry) {
      return {
        t: { start: entry?.start ?? ctx.now() },
        kind: entry?.data.kind ?? 'Bauchzeit',
        ms: entry?.data.ms ?? 0,
        custom: '',
      };
    },
    view(ctx) {
      const now = ctx.now();
      const timer = ctx.store.timerFor(ctx.child.id, 'activity');
      if (timer && timer.kind) d.kind = timer.kind;
      const list = [...ACTIVITIES, ...ctx.state.settings.customActivities];
      return {
        word: timer ? `<span data-sw-since="${timer.start}">${stopwatch(now - timer.start)}</span>` : esc(d.kind),
        wordClass: timer ? 'word--clock' : '',
        sub: timer ? esc(d.kind) : d.ms ? esc(dur(d.ms)) : '',
        body: `
          <div class="chips">${list.map((k) => chip(k, { act: 'activity', value: k, tint: 'sky', pressed: d.kind === k })).join('')}</div>
          ${timerBlock(ctx, 'activity')}
          ${timer ? '' : `
            ${minuteChips(d.ms)}
            ${whenBlock(ctx, 'start', 'Wann')}
            ${d.more ? `
              <div class="inline-add">
                <label class="field"><span>Eigene Aktivität</span><input type="text" maxlength="30" data-bind="custom" autocomplete="off" value="${esc(d.custom)}"></label>
                <button type="button" class="round" data-act="activity-add" aria-label="Aktivität hinzufügen">${icon.plus}</button>
              </div>
              ${noteBlock()}` : moreLink('Mehr Details')}`}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build(ctx) {
      const timer = ctx.store.timerFor(ctx.child.id, 'activity');
      if (timer && !d.entryId) {
        return { start: timer.start, data: { kind: d.kind, ms: ctx.now() - timer.start }, removeTimer: timer.id };
      }
      return { start: d.t.start, data: { kind: d.kind, ms: d.ms } };
    },
    validate: () => null,
  },

  mood: {
    init(ctx, entry) {
      return { t: { start: entry?.start ?? ctx.now() }, mood: entry?.data.mood ?? null };
    },
    view(ctx) {
      return {
        word: esc(label(MOODS, d.mood) || 'Wie geht es dir?'),
        ask: d.mood ? 'Wie geht es dir?' : '',
        body: `
          ${chips(MOODS, { act: 'mood', selected: d.mood, layout: 'moods' })}
          ${d.more ? `${whenBlock(ctx, 'start', 'Wann')}${noteBlock()}` : moreLink('Mehr Details')}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build: () => ({ start: d.t.start, data: { mood: d.mood } }),
    validate: () => (d.mood ? null : 'Wähle zuerst ein Wort.'),
  },

  note: {
    init(ctx, entry) {
      return { t: { start: entry?.start ?? ctx.now() }, note: entry?.note ?? '', done: entry?.data.done ?? false, noteOpen: true };
    },
    view(ctx) {
      return {
        word: 'Für den Termin',
        sub: 'Erscheint im Bericht für den nächsten Arzttermin.',
        body: `
          <label class="field">
            <span>Was möchtest du beim Termin ansprechen?</span>
            <textarea rows="4" maxlength="2000" data-bind="note">${esc(d.note)}</textarea>
          </label>
          ${d.entryId ? `<div class="chips">${chip('Erledigt', { act: 'note-done', tint: 'mint', pressed: d.done })}</div>` : ''}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build: () => ({ start: d.t.start, data: { done: d.done } }),
    validate: () => (d.note.trim() ? null : 'Schreib zuerst etwas auf.'),
  },

  contraction: {
    init(ctx, entry) {
      return { t: { start: entry.start, end: entry.end }, intensity: entry.data.intensity ?? null };
    },
    view(ctx) {
      return {
        word: esc(d.t.end > d.t.start ? durSeconds(d.t.end - d.t.start) : 'Wehe'),
        body: `
          ${chips(INTENSITIES, { act: 'intensity', selected: d.intensity })}
          ${whenBlock(ctx, 'start', 'Beginn')}
          ${whenBlock(ctx, 'end', 'Ende')}
          ${noteBlock()}`,
        primary: go('Speichern', { act: 'save' }),
      };
    },
    build: () => {
      const data = {};
      if (d.intensity) data.intensity = d.intensity;
      return { start: d.t.start, end: d.t.end, data };
    },
    validate: () => null,
  },
};

function foodResults(ctx) {
  const query = d.query.trim().toLowerCase();
  const recent = foodLog(ctx.store.entriesFor(ctx.child.id, ['solids'])).map((f) => f.food);
  const known = FOODS.map((f) => f.name);
  const all = [...new Set([...recent, ...known])];
  const matches = query ? all.filter((n) => n.toLowerCase().includes(query)) : all.slice(0, 10);
  const shown = [...new Set([...d.foods, ...matches])];
  const exact = all.some((n) => n.toLowerCase() === query);
  return `<div class="chips chips--small">
    ${shown.map((name) => {
      const allergen = FOODS.find((f) => f.name === name)?.allergen;
      const text = !allergen ? name : allergen === name ? `${name} (Allergen)` : `${name} (${allergen})`;
      return chip(text, { act: 'food', value: name, tint: allergen ? 'clay' : 'sand', pressed: d.foods.includes(name) });
    }).join('')}
    ${query && !exact ? chip(`«${d.query.trim()}» hinzufügen`, { act: 'food', value: d.query.trim(), tint: 'mint' }) : ''}
  </div>`;
}

// ---------- screen ----------

function timesError(now) {
  const { start, end } = d.t;
  if (start > now + MIN) return 'Der Beginn liegt in der Zukunft. Wähle eine frühere Zeit.';
  if (end && end > now + MIN) return 'Das Ende liegt in der Zukunft. Wähle eine frühere Zeit.';
  if (end && end <= start) return 'Das Ende liegt vor dem Beginn. Prüfe die beiden Zeiten.';
  return null;
}

function finishToast(ctx, entry, undo) {
  const info = describe(entry);
  const text = entry.type === 'note' ? 'Notiz gespeichert' : `${info.title} gespeichert${info.short ? `: ${info.short}` : ''}`;
  ctx.toast(text, undo);
}

function saveEntry(ctx) {
  const now = ctx.now();
  const form = FORMS[d.type];
  const err = timesError(now) ?? form.validate(ctx);
  if (err) {
    d.error = err;
    ctx.rerender();
    return;
  }
  const { removeTimer, ...payload } = form.build(ctx);
  const note = d.note?.trim() ?? '';
  if (d.entryId) {
    const before = ctx.store.updateEntry(d.entryId, { ...payload, note, end: payload.end ?? null });
    const after = ctx.store.entry(d.entryId);
    finishToast(ctx, after, () => ctx.store.restoreEntry(before));
  } else {
    const timer = removeTimer ? ctx.state.timers.find((t) => t.id === removeTimer) : null;
    const entry = ctx.store.addEntry({ childId: ctx.child.id, type: d.type, ...payload, note });
    form.after?.(ctx, entry);
    if (removeTimer) ctx.store.removeTimer(removeTimer);
    finishToast(ctx, entry, () => {
      ctx.store.deleteEntry(entry.id);
      if (timer) ctx.store.restoreTimer(timer);
    });
  }
  ctx.back();
}

function auraFor(ctx) {
  if (!d) return 'rest';
  if (d.type === 'mood') return MOODS.find((m) => m.key === d.mood)?.aura ?? 'rest';
  return TRACKERS[d.type]?.aura ?? 'rest';
}

export const log = {
  enter(ctx) {
    const [param] = ctx.params;
    const isEdit = location.hash.startsWith('#/eintrag/');
    const entry = isEdit ? ctx.store.entry(param) : null;
    if (isEdit && !entry) {
      ctx.toast('Diesen Eintrag gibt es nicht mehr.');
      ctx.nav('#/verlauf');
      d = null;
      return;
    }
    const type = isEdit ? entry.type : param;
    if (!FORMS[type] || (type === 'contraction' && !entry)) {
      d = null;
      ctx.nav('#/heute');
      return;
    }
    d = {
      type,
      entryId: entry?.id ?? null,
      note: entry?.note ?? '',
      open: null,
      error: '',
      more: false,
      noteOpen: !!entry?.note,
      ...FORMS[type].init(ctx, entry),
    };
    const timer = ctx.store.timerFor(ctx.child.id, type);
    if (timer && !entry && type === 'activity' && timer.kind) d.kind = timer.kind;
    if (timer && !entry && type === 'pump' && timer.ml) d.ml = timer.ml;
  },
  aura: auraFor,
  render(ctx) {
    if (!d) return '<section class="screen"></section>';
    const now = ctx.now();
    const view = FORMS[d.type].view(ctx);
    const def = TRACKERS[d.type];
    return `
      <section class="screen moment">
        <header class="bar">
          <button type="button" class="glass" data-act="close" aria-label="Schliessen">${icon.close}</button>
          <div class="bar-title">
            <strong>${esc(d.entryId ? `${def.label} ändern` : def.label)}</strong>
            ${d.entryId
              ? `<span>${esc(dateShort(d.t.start))}, ${esc(clock(d.t.start))}</span>`
              : `<span>${esc(weekday(now))}, <span data-live-clock>${esc(clock(now))}</span></span>`}
          </div>
          ${d.entryId ? `<button type="button" class="glass" data-act="delete" aria-label="Eintrag löschen">${icon.trash}</button>` : '<span></span>'}
        </header>
        <div class="stage">
          <h1 class="word ${view.wordClass ?? ''}">${view.word}</h1>
          ${view.sub ? `<p class="sub">${esc(view.sub)}</p>` : ''}
        </div>
        <div class="sheet">
          ${view.ask ? `<p class="ask">${esc(view.ask)}</p>` : ''}
          ${view.body}
          ${d.error ? `<p class="error" role="alert">${esc(d.error)}</p>` : ''}
          ${view.primary ? `<div class="sheet-end">${view.primary}</div>` : ''}
        </div>
      </section>`;
  },
  input(ctx, el) {
    if (!d) return;
    if (el.dataset.bind) {
      d[el.dataset.bind] = el.value;
      if (el.dataset.word !== undefined) {
        const word = document.querySelector('.word');
        if (word) word.textContent = el.value || TRACKERS[d.type].label;
      }
      if (d.error) { d.error = ''; document.querySelector('.error')?.remove(); }
    }
    if (el.dataset.foodSearch !== undefined) {
      d.query = el.value;
      document.getElementById('food-results').innerHTML = foodResults(ctx);
    }
  },
  change(ctx, el) {
    if (!d || !el.dataset.time) return;
    const field = el.dataset.field;
    const now = ctx.now();
    const current = new Date(d.t[field] ?? now);
    if (el.dataset.time === 'day') {
      if (!el.value) return;
      const day = new Date(fromIso(el.value));
      current.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    } else {
      const value = Number(el.value);
      const max = el.dataset.time === 'hh' ? 23 : 59;
      if (!Number.isInteger(value) || value < 0 || value > max || el.value === '') {
        d.error = el.dataset.time === 'hh' ? 'Die Stunde muss zwischen 0 und 23 liegen.' : 'Die Minute muss zwischen 0 und 59 liegen.';
        ctx.rerender();
        return;
      }
      if (el.dataset.time === 'hh') current.setHours(value);
      else current.setMinutes(value);
    }
    setTime(ctx, field, current.getTime());
  },
  actions: {
    close(ctx) { ctx.back(); },
    save: saveEntry,
    't-open': (ctx, el) => { d.open = d.open === el.dataset.v ? null : el.dataset.v; ctx.rerender(); },
    't-shift': (ctx, el) => {
      const [field, minutes] = el.dataset.v.split(':');
      setTime(ctx, field, ctx.now() - Number(minutes) * MIN);
    },
    'note-open': (ctx) => { d.noteOpen = true; ctx.rerender(); },
    more: (ctx) => { d.more = true; ctx.rerender(); },
    delete(ctx) {
      const entry = ctx.store.entry(d.entryId);
      ctx.store.deleteEntry(d.entryId);
      ctx.toast(`${describe(entry).title} gelöscht`, () => ctx.store.restoreEntry(entry));
      ctx.back('#/verlauf');
    },
    step(ctx, el) {
      const [key, amount] = el.dataset.v.split(':');
      const n = Number(amount);
      if (key === 'ml') d.ml = Math.max(0, Math.min(1000, d.ml + n));
      if (key === 'c') d.celsius = Math.max(34, Math.min(43, Math.round((d.celsius + n) * 10) / 10));
      if (key === 'left' || key === 'right') d[key] = Math.max(0, d[key] + n * MIN);
      ctx.rerender();
    },
    'set-ml': (ctx, el) => { d.ml = Number(el.dataset.v); ctx.rerender(); },
    kind: (ctx, el) => { d.kind = el.dataset.v; d.error = ''; ctx.rerender(); },
    color: (ctx, el) => { d.color = d.color === el.dataset.v ? null : el.dataset.v; ctx.rerender(); },
    mode: (ctx, el) => { d.mode = el.dataset.v; ctx.rerender(); },
    'side-pick': (ctx, el) => { d.side = el.dataset.v; ctx.rerender(); },
    ms: (ctx, el) => { const v = Number(el.dataset.v); d.ms = d.ms === v ? 0 : v; ctx.rerender(); },
    intensity: (ctx, el) => { d.intensity = d.intensity === el.dataset.v ? null : el.dataset.v; ctx.rerender(); },
    mood: (ctx, el) => { d.mood = el.dataset.v; d.error = ''; ctx.rerender(); },
    milestone: (ctx, el) => { d.name = d.name === el.dataset.v ? '' : el.dataset.v; d.custom = ''; d.error = ''; ctx.rerender(); },
    'med-name': (ctx, el) => { d.name = el.dataset.v; ctx.rerender(); },
    remind: (ctx, el) => { d.remind = Number(el.dataset.v); ctx.rerender(); },
    'note-done': (ctx) => { d.done = !d.done; ctx.rerender(); },
    food(ctx, el) {
      const name = el.dataset.v;
      d.foods = d.foods.includes(name) ? d.foods.filter((f) => f !== name) : [...d.foods, name];
      d.query = '';
      ctx.rerender();
    },
    liked: (ctx, el) => { d.liked = d.liked === el.dataset.v ? null : el.dataset.v; ctx.rerender(); },
    reaction: (ctx, el) => { d.reaction = d.reaction === el.dataset.v ? null : el.dataset.v; ctx.rerender(); },
    activity(ctx, el) {
      d.kind = el.dataset.v;
      const timer = ctx.store.timerFor(ctx.child.id, 'activity');
      if (timer) ctx.store.setTimer({ ...timer, kind: d.kind });
      ctx.rerender();
    },
    'activity-add'(ctx) {
      const name = d.custom.trim();
      if (!name) {
        d.error = 'Schreib zuerst einen Namen für die Aktivität.';
        ctx.rerender();
        return;
      }
      const list = ctx.state.settings.customActivities;
      if (![...ACTIVITIES, ...list].includes(name)) ctx.store.updateSettings({ customActivities: [...list, name] });
      d.kind = name;
      d.custom = '';
      d.error = '';
      ctx.rerender();
    },

    'timer-start'(ctx) {
      const extra = d.type === 'activity' ? { kind: d.kind } : d.type === 'pump' ? { ml: d.ml } : {};
      ctx.store.startTimer(ctx.child.id, d.type, extra);
      ctx.rerender();
    },
    'timer-drop'(ctx) {
      const timer = ctx.store.timerFor(ctx.child.id, d.type);
      if (!timer) return;
      ctx.store.removeTimer(timer.id);
      ctx.toast('Timer verworfen', () => ctx.store.restoreTimer(timer));
      Object.assign(d, FORMS[d.type].init(ctx, null));
      ctx.rerender();
    },

    'sleep-start'(ctx) {
      ctx.store.startTimer(ctx.child.id, 'sleep', { wakes: [] });
      ctx.nav('#/heute');
    },
    'sleep-manual': (ctx) => { d.manual = true; ctx.rerender(); },
    wake(ctx) {
      const timer = ctx.store.timerFor(ctx.child.id, 'sleep');
      ctx.store.setTimer(toggleWake(timer, ctx.now()));
      ctx.rerender();
    },
    'sleep-stop'(ctx) {
      const timer = ctx.store.timerFor(ctx.child.id, 'sleep');
      const now = ctx.now();
      const end = d.endEdited ? d.t.end : now;
      d.t.start = timer.start;
      d.t.end = end;
      const err = timesError(now);
      if (err) {
        d.error = err;
        ctx.rerender();
        return;
      }
      const entry = ctx.store.addEntry({
        childId: ctx.child.id,
        type: 'sleep',
        start: timer.start,
        end,
        data: { wakes: closeWakes(timer.wakes, end).filter((w) => w.from < end) },
      });
      ctx.store.removeTimer(timer.id);
      finishToast(ctx, entry, () => {
        ctx.store.deleteEntry(entry.id);
        ctx.store.restoreTimer(timer);
      });
      ctx.nav('#/heute');
    },
    'sleep-resume'(ctx) {
      const entry = ctx.store.entry(d.entryId);
      const timer = ctx.store.startTimer(ctx.child.id, 'sleep', { wakes: entry.data.wakes ?? [] });
      ctx.store.setTimer({ ...timer, start: entry.start });
      ctx.store.deleteEntry(entry.id);
      ctx.toast('Schlaf läuft weiter');
      ctx.nav('#/heute');
    },

    side(ctx, el) {
      const child = ctx.child;
      const now = ctx.now();
      const timer = ctx.store.timerFor(child.id, 'nursing') ?? ctx.store.startTimer(child.id, 'nursing', emptyNursing());
      ctx.store.setTimer(toggleSide(timer, el.dataset.v, now));
      ctx.rerender();
    },
    'nursing-manual': (ctx) => { d.manual = true; ctx.rerender(); },
    'nursing-save'(ctx) {
      const timer = ctx.store.timerFor(ctx.child.id, 'nursing');
      const now = ctx.now();
      const totals = sideTotals(timer, now);
      const entry = ctx.store.addEntry({
        childId: ctx.child.id,
        type: 'nursing',
        start: timer.start,
        end: now,
        data: { left: totals.left, right: totals.right, lastSide: timer.active ?? (totals.right && !totals.left ? 'right' : 'left') },
      });
      ctx.store.removeTimer(timer.id);
      finishToast(ctx, entry, () => {
        ctx.store.deleteEntry(entry.id);
        ctx.store.restoreTimer(timer);
      });
      ctx.back();
    },
  },
};

function setTime(ctx, field, ts) {
  d.t[field] = ts;
  d.error = '';
  if (field === 'end') d.endEdited = true;
  if (field === 'start' && !d.entryId) {
    const timer = ctx.store.timerFor(ctx.child.id, d.type);
    if (timer && d.type === 'sleep') ctx.store.setTimer({ ...timer, start: ts });
  }
  ctx.rerender();
}

