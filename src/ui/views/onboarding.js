import { HOME_DEFAULT, OPTIONAL_TRACKERS, TRACKERS } from '../../core/catalog.js';
import { demoState } from '../../core/demo.js';
import { isPlausibleDueDate } from '../../core/pregnancy.js';
import { fromIso, isValidIso, isoDate } from '../../core/time.js';
import { chip, chips, esc, go, icon } from '../dom.js';

let d = null;
const fresh = () => ({ step: 0, phase: null, name: '', date: '', due: '', sex: null, home: [...HOME_DEFAULT], error: '' });

const STEPS = (phase) => (phase === 'born' ? 3 : 2);
const SEX = [
  { key: 'f', label: 'Mädchen', tint: 'rose' },
  { key: 'm', label: 'Bub', tint: 'sky' },
];

function stepOne() {
  return {
    word: d.phase === 'expecting' ? 'Schwanger' : d.phase === 'born' ? 'Baby ist da' : 'Flaum',
    sub: d.phase ? '' : 'Kein Konto, kein Abo. Alles bleibt auf diesem Gerät.',
    body: `
      <p class="ask">Wo stehst du gerade?</p>
      ${chips([
        { key: 'expecting', label: 'Ich bin schwanger', tint: 'rose' },
        { key: 'born', label: 'Unser Baby ist da', tint: 'sky' },
      ], { act: 'phase', selected: d.phase })}`,
    extra: '<button type="button" class="link" data-act="demo">Mit Beispieldaten ansehen</button>',
  };
}

function stepTwo(ctx) {
  const today = isoDate(ctx.now());
  if (d.phase === 'expecting') {
    return {
      word: d.name || 'Der Termin',
      sub: '',
      body: `
        <label class="field">
          <span>Wann ist der errechnete Termin?</span>
          <input type="date" data-bind="date" value="${esc(d.date)}" min="${today.slice(0, 4)}-01-01">
        </label>
        <label class="field">
          <span>Name oder Spitzname, wenn ihr wollt</span>
          <input type="text" data-bind="name" maxlength="40" autocomplete="off" value="${esc(d.name)}">
        </label>`,
    };
  }
  return {
    word: d.name || 'Euer Baby',
    sub: '',
    body: `
      <label class="field">
        <span>Name</span>
        <input type="text" data-bind="name" maxlength="40" autocomplete="off" value="${esc(d.name)}">
      </label>
      <label class="field">
        <span>Geburtsdatum</span>
        <input type="date" data-bind="date" value="${esc(d.date)}" max="${today}">
      </label>
      <label class="field">
        <span>Errechneter Termin, freiwillig</span>
        <input type="date" data-bind="due" value="${esc(d.due)}">
        <small>Bei Frühgeborenen rechnet Flaum dann mit dem korrigierten Alter.</small>
      </label>
      <p class="ask ask--small">Für die WHO-Wachstumskurven, freiwillig</p>
      ${chips(SEX, { act: 'sex', selected: d.sex })}`,
  };
}

function stepThree() {
  return {
    word: `${d.home.length} von ${OPTIONAL_TRACKERS.length}`,
    sub: 'Das andere bleibt unter «Mehr». Du kannst es jederzeit ändern.',
    body: `
      <p class="ask">Was möchtest du festhalten?</p>
      <div class="chips">${OPTIONAL_TRACKERS.map((key) => chip(TRACKERS[key].label, {
        act: 'home',
        value: key,
        tint: TRACKERS[key].tint,
        pressed: d.home.includes(key),
      })).join('')}</div>`,
  };
}

export const onboarding = {
  isOpen: () => d !== null,
  enter() { if (!d) d = fresh(); },
  aura() {
    if (!d) return 'rest';
    if (d.phase === 'expecting') return 'nursing';
    if (d.phase === 'born') return 'bottle';
    return 'rest';
  },
  render(ctx) {
    if (!d) d = fresh();
    const step = d.step === 0 ? stepOne() : d.step === 1 ? stepTwo(ctx) : stepThree();
    const total = STEPS(d.phase);
    const pct = Math.round(((d.step + 1) / total) * 100);
    return `
      <section class="screen moment onboarding">
        <header class="bar">
          ${d.step > 0 ? `<button type="button" class="glass" data-act="prev" aria-label="Zurück">${icon.back}</button>` : '<span></span>'}
          <div class="bar-title">
            <div class="progress" role="progressbar" aria-label="Schritt ${d.step + 1} von ${total}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
          </div>
          <span></span>
        </header>
        <div class="stage">
          <h1 class="word">${esc(step.word)}</h1>
          ${step.sub ? `<p class="sub">${esc(step.sub)}</p>` : ''}
        </div>
        <div class="sheet">
          ${step.body}
          ${d.error ? `<p class="error" role="alert">${esc(d.error)}</p>` : ''}
          <div class="sheet-end">${go(d.step === total - 1 ? 'Fertig' : 'Weiter', { act: 'next', icon: d.step === total - 1 ? icon.check : icon.arrow })}</div>
          ${step.extra ?? ''}
        </div>
      </section>`;
  },
  input(ctx, el) {
    if (el.dataset.bind && d) {
      d[el.dataset.bind] = el.value;
      if (el.dataset.bind === 'name') {
        const word = document.querySelector('.word');
        if (word) word.textContent = el.value || (d.phase === 'expecting' ? 'Der Termin' : 'Euer Baby');
      }
    }
  },
  actions: {
    phase(ctx, el) { d.phase = el.dataset.v; d.error = ''; ctx.rerender(); },
    sex(ctx, el) { d.sex = d.sex === el.dataset.v ? null : el.dataset.v; ctx.rerender(); },
    home(ctx, el) {
      const key = el.dataset.v;
      d.home = d.home.includes(key) ? d.home.filter((k) => k !== key) : [...d.home, key];
      ctx.rerender();
    },
    prev(ctx) { d.step -= 1; d.error = ''; ctx.rerender(); },
    demo(ctx) {
      d = null;
      ctx.store.replaceState(demoState(ctx.now()));
      ctx.nav('#/heute');
    },
    next(ctx) {
      d.error = '';
      if (d.step === 0 && !d.phase) {
        d.error = 'Wähle eine der beiden Möglichkeiten.';
        ctx.rerender();
        return;
      }
      if (d.step === 1) {
        const now = ctx.now();
        if (!isValidIso(d.date)) {
          d.error = d.phase === 'expecting' ? 'Trag den errechneten Termin ein.' : 'Trag das Geburtsdatum ein.';
        } else if (d.phase === 'expecting' && !isPlausibleDueDate(d.date, now)) {
          d.error = 'Dieser Termin liegt mehr als 40 Wochen voraus oder über einen Monat zurück. Prüfe das Datum.';
        } else if (d.phase === 'born' && fromIso(d.date) > now) {
          d.error = 'Das Geburtsdatum liegt in der Zukunft. Prüfe das Datum.';
        } else if (d.phase === 'born' && d.due && !isValidIso(d.due)) {
          d.error = 'Der errechnete Termin ist kein gültiges Datum.';
        }
        if (d.error) {
          ctx.rerender();
          return;
        }
      }
      if (d.step < STEPS(d.phase) - 1) {
        d.step += 1;
        ctx.rerender();
        return;
      }
      const expecting = d.phase === 'expecting';
      ctx.store.addChild({
        name: d.name.trim() || 'Baby',
        phase: d.phase,
        dueDate: expecting ? d.date : (d.due || null),
        birthDate: expecting ? null : d.date,
        sex: d.sex,
      });
      if (!expecting) ctx.store.updateSettings({ home: d.home });
      d = null;
      ctx.nav('#/heute');
    },
  },
};
