import { OPTIONAL_TRACKERS, TRACKERS } from '../../core/catalog.js';
import { reminderToIcs } from '../../core/ics.js';
import { isPlausibleDueDate } from '../../core/pregnancy.js';
import { ageLabel, atTime, clock, dateShort, fromIso, isValidIso, isoDate, startOfDay } from '../../core/time.js';
import { chip, chips, download, esc, go, icon, miniHeader, sanitizePhone } from '../dom.js';

let confirmReset = false;

const THEMES = [
  { key: 'auto', label: 'Automatisch', tint: 'sand' },
  { key: 'light', label: 'Hell', tint: 'butter' },
  { key: 'dark', label: 'Nacht', tint: 'peri' },
];

export const settings = {
  enter() { confirmReset = false; },
  aura: () => 'rest',
  render(ctx) {
    const st = ctx.state.settings;
    return `
      <section class="screen screen--page">
        ${miniHeader('Einstellungen')}
        <div class="sheet sheet--fill">
          ${ctx.state.demo ? `
            <div class="callout"><p>Du siehst Beispieldaten. Unter «Daten» kannst du sie löschen und mit deinen eigenen beginnen.</p></div>` : ''}

          <h2 class="section-title">Kinder</h2>
          <ul class="rows">
            ${ctx.store.liveChildren().map((c) => `
              <li><a class="row row--plain" href="#/kind/${esc(c.id)}">${esc(c.name)}<small>${esc(c.phase === 'expecting' ? 'Schwanger' : ageLabel(c.birthDate, ctx.now()))}</small></a></li>`).join('')}
            <li><a class="row row--plain" href="#/kind/neu">Kind hinzufügen</a></li>
          </ul>

          <h2 class="section-title">Auf der Startseite</h2>
          <div class="chips">
            ${OPTIONAL_TRACKERS.map((key) => chip(TRACKERS[key].label, { act: 'home', value: key, tint: TRACKERS[key].tint, pressed: st.home.includes(key) })).join('')}
          </div>

          <h2 class="section-title">Anzeige</h2>
          ${chips(THEMES, { act: 'theme', selected: st.theme })}

          <h2 class="section-title">Schlafzeiten</h2>
          <div class="chips">
            ${chip('Hinweise anzeigen', { act: 'hints', tint: 'peri', pressed: st.sleepHints })}
          </div>
          <p class="fineprint">Ausgeschaltet zeigt die Startseite keine Vorschläge mehr. Der Tagesplan bleibt unter «Mehr» erreichbar.</p>

          <h2 class="section-title">Spital oder Hebamme</h2>
          <label class="field"><span>Name</span><input type="text" maxlength="40" data-setting="phoneLabel" value="${esc(st.phoneLabel)}" placeholder="Hebamme" autocomplete="off"></label>
          <label class="field"><span>Telefonnummer</span><input type="tel" maxlength="30" data-setting="phone" value="${esc(st.phone)}" autocomplete="off"></label>
          <p class="fineprint">Im Wehentimer rufst du diese Nummer mit einem Tipp an.</p>

          <h2 class="section-title">Hilfen</h2>
          <ul class="rows">
            <li><a class="row row--plain" href="#/erinnerungen">Erinnerungen</a></li>
            <li><a class="row row--plain" href="#/bericht">Bericht für den Arzttermin</a></li>
          </ul>

          <h2 class="section-title">Daten</h2>
          <p class="fineprint">Alles liegt nur auf diesem Gerät. Flaum sendet nichts ins Internet. Sichere die Datei ab und zu an einem zweiten Ort. Wenn du sie an deine Partnerin oder deinen Partner schickst und dort einliest, werden beide Stände zusammengeführt.</p>
          <div class="actions">
            <button type="button" class="action" data-act="backup">${icon.share}<span>Daten sichern</span></button>
            <label class="action">${icon.plus}<span>Datei einlesen</span><input class="sr-only" type="file" accept=".json,application/json" data-import></label>
          </div>
          ${confirmReset ? `
            <div class="callout">
              <p>Wirklich alles löschen? Das lässt sich nicht rückgängig machen. Sichere die Daten vorher, wenn du sie behalten willst.</p>
              <div class="chips">
                ${chip('Ja, alles löschen', { act: 'reset-yes', tint: 'coral' })}
                ${chip('Abbrechen', { act: 'reset-no', tint: 'sand' })}
              </div>
            </div>`
            : '<button type="button" class="link" data-act="reset-ask">Alle Daten löschen</button>'}

          <h2 class="section-title">Gut zu wissen</h2>
          <p class="fineprint">Flaum ersetzt keine medizinische Beratung. Die Hinweise sind allgemeine Richtwerte. Bei Sorgen ruf deine Hebamme, die Kinderarztpraxis oder im Notfall 144 an.</p>
          <p class="fineprint">Wachstumskurven: WHO Child Growth Standards. Hinweise zu den Wehen nach Merkblättern des Kantonsspitals Baden und der Spitäler fmi.</p>
        </div>
      </section>`;
  },
  change(ctx, el) {
    if (el.dataset.setting) {
      ctx.store.updateSettings({ [el.dataset.setting]: el.dataset.setting === 'phone' ? sanitizePhone(el.value) : el.value });
      return;
    }
    if (el.dataset.import !== undefined && el.files?.[0]) {
      const file = el.files[0];
      file.text().then((text) => {
        try {
          const { added, updated } = ctx.store.importBackup(text);
          ctx.toast(`Datei eingelesen: ${added} neu, ${updated} aktualisiert`);
          ctx.rerender();
        } catch (error) {
          ctx.toast(error.message, null, { error: true });
        }
      });
    }
  },
  actions: {
    home(ctx, el) {
      const key = el.dataset.v;
      const { home } = ctx.state.settings;
      ctx.store.updateSettings({ home: home.includes(key) ? home.filter((k) => k !== key) : [...home, key] });
      ctx.rerender();
    },
    theme(ctx, el) { ctx.store.updateSettings({ theme: el.dataset.v }); ctx.rerender(); },
    hints(ctx) { ctx.store.updateSettings({ sleepHints: !ctx.state.settings.sleepHints }); ctx.rerender(); },
    backup(ctx) {
      download(`flaum-sicherung-${isoDate(ctx.now())}.json`, ctx.store.exportBackup(), 'application/json');
      ctx.toast('Sicherung erstellt. Lege sie an einem zweiten Ort ab.');
    },
    'reset-ask'(ctx) { confirmReset = true; ctx.rerender(); },
    'reset-no'(ctx) { confirmReset = false; ctx.rerender(); },
    'reset-yes'(ctx) {
      ctx.store.reset();
      confirmReset = false;
      ctx.nav('#/start');
    },
  },
};

// ---------- switch child ----------

export const childSwitch = {
  aura: () => 'rest',
  render(ctx) {
    const active = ctx.child;
    return `
      <section class="screen screen--page">
        ${miniHeader('Kinder')}
        <div class="sheet sheet--fill">
          <div class="chips">
            ${ctx.store.liveChildren().map((c) => chip(c.name, { act: 'pick', value: c.id, tint: c.phase === 'expecting' ? 'rose' : 'sky', pressed: c.id === active.id })).join('')}
          </div>
          <ul class="rows">
            <li><a class="row row--plain" href="#/kind/${esc(active.id)}">${esc(active.name)} bearbeiten</a></li>
            <li><a class="row row--plain" href="#/kind/neu">Kind hinzufügen</a></li>
          </ul>
        </div>
      </section>`;
  },
  actions: {
    pick(ctx, el) {
      ctx.store.setActiveChild(el.dataset.v);
      ctx.nav('#/heute');
    },
  },
};

// ---------- edit child ----------

let c = null;
const PHASES = [
  { key: 'expecting', label: 'Schwanger', tint: 'rose' },
  { key: 'born', label: 'Geboren', tint: 'sky' },
];
const SEX = [
  { key: 'f', label: 'Mädchen', tint: 'rose' },
  { key: 'm', label: 'Bub', tint: 'sky' },
];

export const childEdit = {
  enter(ctx) {
    const hash = location.hash;
    const [param] = ctx.params;
    const id = param === 'neu' ? null : param;
    const existing = id ? ctx.store.liveChildren().find((x) => x.id === id) : null;
    c = {
      id: existing?.id ?? null,
      name: existing?.name ?? '',
      phase: existing?.phase ?? 'born',
      dueDate: existing?.dueDate ?? '',
      birthDate: existing?.birthDate ?? '',
      sex: existing?.sex ?? null,
      error: '',
      confirmDelete: false,
    };
    if (hash.includes('?geboren')) c.phase = 'born';
  },
  aura: () => 'rest',
  render(ctx) {
    const today = isoDate(ctx.now());
    return `
      <section class="screen screen--page">
        ${miniHeader(c.id ? c.name || 'Kind' : 'Kind hinzufügen', { back: '#/einstellungen' })}
        <div class="sheet sheet--fill">
          ${chips(PHASES, { act: 'phase', selected: c.phase })}
          <label class="field"><span>Name</span><input type="text" maxlength="40" data-bind="name" value="${esc(c.name)}" autocomplete="off"></label>
          ${c.phase === 'born' ? `
            <label class="field"><span>Geburtsdatum</span><input type="date" data-bind="birthDate" value="${esc(c.birthDate)}" max="${today}"></label>
            <label class="field"><span>Errechneter Termin, freiwillig</span><input type="date" data-bind="dueDate" value="${esc(c.dueDate)}"><small>Bei Frühgeborenen rechnet Flaum dann mit dem korrigierten Alter.</small></label>
            <p class="ask ask--small">Für die WHO-Wachstumskurven, freiwillig</p>
            ${chips(SEX, { act: 'sex', selected: c.sex })}`
            : `<label class="field"><span>Errechneter Termin</span><input type="date" data-bind="dueDate" value="${esc(c.dueDate)}"></label>`}
          ${c.error ? `<p class="error" role="alert">${esc(c.error)}</p>` : ''}
          <div class="sheet-end">${go('Speichern', { act: 'save' })}</div>
          ${c.id && !c.confirmDelete ? '<button type="button" class="link" data-act="ask-delete">Kind und alle Einträge löschen</button>' : ''}
          ${c.confirmDelete ? `
            <div class="callout">
              <p>Wirklich ${esc(c.name)} und alle Einträge löschen? Das lässt sich nicht rückgängig machen.</p>
              <div class="chips">
                ${chip('Ja, löschen', { act: 'delete-yes', tint: 'coral' })}
                ${chip('Abbrechen', { act: 'delete-no', tint: 'sand' })}
              </div>
            </div>` : ''}
        </div>
      </section>`;
  },
  input(ctx, el) { if (el.dataset.bind) c[el.dataset.bind] = el.value; },
  actions: {
    phase(ctx, el) { c.phase = el.dataset.v; c.error = ''; ctx.rerender(); },
    sex(ctx, el) { c.sex = c.sex === el.dataset.v ? null : el.dataset.v; ctx.rerender(); },
    'ask-delete'(ctx) { c.confirmDelete = true; ctx.rerender(); },
    'delete-no'(ctx) { c.confirmDelete = false; ctx.rerender(); },
    'delete-yes'(ctx) {
      ctx.store.deleteChild(c.id);
      ctx.nav(ctx.store.liveChildren().length ? '#/heute' : '#/start');
    },
    save(ctx) {
      const now = ctx.now();
      c.error = '';
      if (c.phase === 'born') {
        if (!isValidIso(c.birthDate)) c.error = 'Trag das Geburtsdatum ein.';
        else if (fromIso(c.birthDate) > now) c.error = 'Das Geburtsdatum liegt in der Zukunft. Prüfe das Datum.';
        else if (c.dueDate && !isValidIso(c.dueDate)) c.error = 'Der errechnete Termin ist kein gültiges Datum.';
      } else if (!isValidIso(c.dueDate)) {
        c.error = 'Trag den errechneten Termin ein.';
      } else if (!isPlausibleDueDate(c.dueDate, now)) {
        c.error = 'Dieser Termin liegt mehr als 40 Wochen voraus oder über einen Monat zurück. Prüfe das Datum.';
      }
      if (c.error) {
        ctx.rerender();
        return;
      }
      const fields = {
        name: c.name.trim() || 'Baby',
        phase: c.phase,
        dueDate: c.dueDate || null,
        birthDate: c.phase === 'born' ? c.birthDate : null,
        sex: c.sex,
      };
      if (c.id) ctx.store.updateChild(c.id, fields);
      else ctx.store.addChild(fields);
      ctx.toast(`${fields.name} gespeichert`);
      ctx.nav('#/heute');
    },
  },
};

// ---------- reminders ----------

let r = null;
const freshReminder = () => ({ title: '', time: '08:00', repeat: 'daily', error: '' });

const reminderLine = (rem, now) => {
  if (rem.at) return `${dateShort(rem.at)}, ${clock(rem.at)}${rem.at < now ? ', vorbei' : ''}`;
  const time = clock(atTime(startOfDay(now), rem.hour, rem.minute));
  return rem.repeat === 'daily' ? `Täglich um ${time}` : `Einmal um ${time}`;
};

export const reminders = {
  enter() { r = freshReminder(); },
  aura: () => 'medicine',
  render(ctx) {
    const list = ctx.store.liveReminders().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    const now = ctx.now();
    const canNotify = 'Notification' in window;
    return `
      <section class="screen screen--page">
        ${miniHeader('Erinnerungen')}
        <div class="sheet sheet--fill">
          <p class="fineprint">Damit eine Erinnerung auch bei geschlossener App kommt, übernimm sie in deinen Kalender. Ohne Kalender erscheint sie nur, solange Flaum offen ist.</p>
          ${list.length ? `
            <ul class="rows">
              ${list.map((rem) => `
                <li class="row row--static">
                  <span class="row-main"><strong>${esc(rem.title)}</strong><small>${esc(reminderLine(rem, now))}</small></span>
                  <span class="row-actions">
                    <button type="button" class="round round--quiet" data-act="ics" data-v="${esc(rem.id)}" aria-label="${esc(rem.title)} in den Kalender übernehmen">${icon.share}</button>
                    <button type="button" class="round round--quiet" data-act="remove" data-v="${esc(rem.id)}" aria-label="${esc(rem.title)} löschen">${icon.trash}</button>
                  </span>
                </li>`).join('')}
            </ul>` : '<p class="empty">Noch keine Erinnerungen.</p>'}

          <h2 class="section-title">Neue Erinnerung</h2>
          <label class="field"><span>Woran?</span><input type="text" maxlength="100" data-bind="title" value="${esc(r.title)}" placeholder="Vitamin D" autocomplete="off"></label>
          <label class="field"><span>Uhrzeit</span><input type="time" data-bind="time" value="${esc(r.time)}"></label>
          <div class="chips">
            ${chip('Täglich', { act: 'repeat', value: 'daily', tint: 'lilac', pressed: r.repeat === 'daily' })}
            ${chip('Einmal', { act: 'repeat', value: 'once', tint: 'lilac', pressed: r.repeat === 'once' })}
          </div>
          ${r.error ? `<p class="error" role="alert">${esc(r.error)}</p>` : ''}
          <div class="sheet-end">${go('Erinnerung speichern', { act: 'add' })}</div>
          ${canNotify && Notification.permission === 'default' ? '<button type="button" class="link" data-act="permission">Mitteilungen erlauben, solange Flaum offen ist</button>' : ''}
        </div>
      </section>`;
  },
  input(ctx, el) { if (el.dataset.bind) r[el.dataset.bind] = el.value; },
  actions: {
    repeat(ctx, el) { r.repeat = el.dataset.v; ctx.rerender(); },
    add(ctx) {
      const title = r.title.trim();
      const match = /^(\d{1,2}):(\d{2})$/.exec(r.time);
      if (!title) r.error = 'Schreib zuerst, woran Flaum erinnern soll.';
      else if (!match) r.error = 'Wähle eine Uhrzeit.';
      if (!title || !match) {
        ctx.rerender();
        return;
      }
      const now = ctx.now();
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      const fields = { title, repeat: r.repeat, hour, minute };
      if (r.repeat === 'once') {
        let at = atTime(startOfDay(now), hour, minute);
        if (at < now) at = atTime(startOfDay(now + 86_400_000), hour, minute);
        fields.at = at;
      } else {
        // A new daily reminder starts with its next occurrence, not one already past today.
        fields.firedAt = now;
      }
      ctx.store.addReminder(fields);
      ctx.toast('Erinnerung gespeichert');
      r = freshReminder();
      ctx.rerender();
    },
    ics(ctx, el) {
      const reminder = ctx.store.liveReminders().find((x) => x.id === el.dataset.v);
      if (!reminder) return;
      download(`flaum-erinnerung.ics`, reminderToIcs(reminder, ctx.now()), 'text/calendar');
    },
    remove(ctx, el) {
      const id = el.dataset.v;
      const reminder = ctx.store.liveReminders().find((x) => x.id === id);
      ctx.store.deleteReminder(id);
      ctx.toast(`${reminder.title} gelöscht`, () => ctx.store.updateReminder(id, { deletedAt: undefined }));
      ctx.rerender();
    },
    async permission(ctx) {
      await Notification.requestPermission();
      ctx.rerender();
    },
  },
};
