import { OPTIONAL_TRACKERS, TRACKERS } from '../../core/catalog.js';
import { describe } from '../../core/describe.js';
import { parseQuick } from '../../core/parse.js';
import { clock, dayWord } from '../../core/time.js';
import { esc, go, miniHeader } from '../dom.js';

let text = '';
let parsed = null;
let error = '';

function preview(ctx) {
  if (!text.trim()) return '';
  if (!parsed) {
    return '<p class="tip" id="quick-preview">Das verstehe ich noch nicht. Beispiele: «Flasche 120 ml vor 20 Min», «Windel voll», «Nickerchen 13:00 bis 14:10».</p>';
  }
  const info = describe({ ...parsed, end: parsed.end });
  const now = ctx.now();
  return `<p class="tip" id="quick-preview"><strong>${esc(info.title)}:</strong> ${esc(info.detail)}, ${esc(dayWord(parsed.start, now))} ${esc(clock(parsed.start))}</p>`;
}

export const more = {
  enter() { text = ''; parsed = null; error = ''; },
  aura: () => 'rest',
  render(ctx) {
    const expecting = ctx.child.phase === 'expecting';
    const others = expecting
      ? ['mood', 'note']
      : OPTIONAL_TRACKERS.filter((t) => !ctx.state.settings.home.includes(t));
    return `
      <section class="screen screen--page">
        ${miniHeader('Mehr festhalten')}
        <div class="sheet sheet--fill">
          <h2 class="section-title">Schnell eintragen</h2>
          <label class="field">
            <span>Tippe oder diktiere, was war. Du siehst es vor dem Speichern.</span>
            <input type="text" data-quick value="${esc(text)}" autocomplete="off" placeholder="Flasche 120 ml vor 20 Min">
          </label>
          <div id="quick-result">${preview(ctx)}${parsed ? `<div class="sheet-end">${go('Speichern', { act: 'quick-save' })}</div>` : ''}</div>
          ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}

          <h2 class="section-title">Weitere Einträge</h2>
          <div class="chips">
            ${others.map((t) => `<a class="chip t-${TRACKERS[t].tint}" href="#/log/${t}">${esc(TRACKERS[t].label)}</a>`).join('')}
            ${expecting ? '<a class="chip t-coral" href="#/wehen">Wehen</a>' : ''}
          </div>

          <h2 class="section-title">Hilfen</h2>
          <ul class="rows">
            ${expecting ? '' : '<li><a class="row row--plain" href="#/tagesplan">Tagesplan</a></li>'}
            <li><a class="row row--plain" href="#/erinnerungen">Erinnerungen</a></li>
            <li><a class="row row--plain" href="#/bericht">Bericht für den Arzttermin</a></li>
          </ul>
        </div>
      </section>`;
  },
  input(ctx, el) {
    if (el.dataset.quick === undefined) return;
    text = el.value;
    parsed = parseQuick(text, ctx.now());
    document.getElementById('quick-result').innerHTML = `${preview(ctx)}${parsed ? `<div class="sheet-end">${go('Speichern', { act: 'quick-save' })}</div>` : ''}`;
  },
  actions: {
    'quick-save'(ctx) {
      if (!parsed) return;
      const entry = ctx.store.addEntry({ childId: ctx.child.id, ...parsed });
      const info = describe(entry);
      ctx.toast(`${info.title} gespeichert${info.short ? `: ${info.short}` : ''}`, () => ctx.store.deleteEntry(entry.id));
      text = '';
      parsed = null;
      ctx.nav('#/heute');
    },
  },
};
