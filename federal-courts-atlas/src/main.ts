// Entry point: styles, theme, shell, router. Page modules load on demand.

import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/components.css';
import './styles/map.css';

import { initTheme } from './app/theme.ts';
import { buildShell } from './app/shell.ts';
import { match, parseHash, type Cleanup, type PageContext } from './app/router.ts';
import { loadAtlasGeometry } from './map/geo.ts';
import { hidePopover } from './components/glossary.ts';
import { h } from './lib/dom.ts';

performance.mark('atlas:boot');
initTheme();

// The national map is the front door: start fetching its topology immediately,
// in parallel with the home page chunk.
if (parseHash().path === '') void loadAtlasGeometry();

const shell = buildShell(document.getElementById('app')!);
let cleanup: Cleanup | void;
let navSeq = 0;
let first = true;

async function render(): Promise<void> {
  const seq = ++navSeq;
  const { path, query } = parseHash();
  const m = match(path);
  shell.setActive(path);
  hidePopover();
  if (typeof cleanup === 'function') cleanup();
  cleanup = undefined;
  const root = h('div', { class: 'page-root' });
  if (!m) {
    const nf = await import('./pages/not-found.ts');
    if (seq !== navSeq) return;
    shell.main.replaceChildren(root);
    nf.render({ root, params: {}, query, path });
    document.title = 'Page not found · The Federal Courts Atlas';
    return;
  }
  let mod;
  try {
    mod = await m.route.load();
  } catch (e) {
    // A stale chunk after a redeploy: reload once to pick up the new build.
    console.error(e);
    shell.main.replaceChildren(h('div', { class: 'page' }, h('p', null, 'This page could not be loaded. Please reload.')));
    return;
  }
  if (seq !== navSeq) return;
  const ctx: PageContext = { root, params: m.params, query, path };
  shell.main.replaceChildren(root);
  const title = typeof mod.title === 'function' ? mod.title(ctx) : mod.title;
  document.title = title ? `${title} · The Federal Courts Atlas` : 'The Federal Courts Atlas';
  document.documentElement.dataset.route = m.route.name;
  cleanup = await mod.render(ctx);
  if (!first) {
    window.scrollTo(0, 0);
    // Move focus to the new page's heading so screen-reader users hear the change.
    const h1 = shell.main.querySelector('h1');
    if (h1) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
  }
  first = false;
}

window.addEventListener('hashchange', () => void render());
void render();
