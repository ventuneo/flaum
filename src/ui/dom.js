const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

const svg = (path, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const icon = {
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  left: svg('<path d="M15 6l-6 6 6 6"/>'),
  right: svg('<path d="M9 6l6 6-6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>', 18),
  gear: svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
  trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z"/>'),
  phone: svg('<path d="M6 4h3l1.5 4.5L8.3 10a12 12 0 005.7 5.7l1.5-2.2L20 15v3a2 2 0 01-2 2A14 14 0 014 6a2 2 0 012-2z"/>', 20),
  share: svg('<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>', 20),
};

/** One tinted choice. Tinted means available, white means chosen. Nothing else carries that meaning. */
export function chip(text, { act, value = '', pressed = false, tint = 'sand', extra = '' } = {}) {
  return `<button type="button" class="chip t-${tint}${pressed ? ' is-on' : ''}" data-act="${esc(act)}" data-v="${esc(value)}" aria-pressed="${pressed}" ${extra}>${esc(text)}</button>`;
}

export const chips = (items, { act, selected, multi = false, layout = '' }) =>
  `<div class="chips${layout ? ` chips--${layout}` : ''}">${items
    .map((item) => chip(item.label, {
      act,
      value: item.key,
      tint: item.tint,
      pressed: multi ? (selected ?? []).includes(item.key) : selected === item.key,
    }))
    .join('')}</div>`;

// The primary action is a plain filled button with its label in the middle.
// A knob at one end made it look like a slider that has to be dragged.
export const go = (text, { act, href = null, extra = '' } = {}) =>
  (href
    ? `<a class="go" href="${esc(href)}" ${extra}>${esc(text)}</a>`
    : `<button type="button" class="go" data-act="${esc(act)}" ${extra}>${esc(text)}</button>`);

export const pillNav = (current) => `
  <div class="navdock">
    <nav class="pillnav" aria-label="Hauptbereiche">
      <a href="#/heute" ${current === 'heute' ? 'aria-current="page"' : ''}>Heute</a>
      <a href="#/verlauf" ${current === 'verlauf' ? 'aria-current="page"' : ''}>Verlauf</a>
    </nav>
  </div>`;

export const miniHeader = (title, { back = '#/heute', right = '' } = {}) => `
  <header class="bar">
    <a class="glass" href="${esc(back)}" data-back aria-label="Zurück">${icon.back}</a>
    <div class="bar-title"><h1>${esc(title)}</h1></div>
    <div class="bar-side">${right}</div>
  </header>`;

export function sanitizePhone(value) {
  return String(value ?? '').replace(/[^\d+]/g, '').slice(0, 20);
}

export function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Uses the phone's share sheet when it can, otherwise copies the text. Returns what happened. */
export async function shareText(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'aborted';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
