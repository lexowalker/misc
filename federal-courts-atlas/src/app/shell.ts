// App shell: skip link, header (wordmark, nav, theme toggle), main, footer.

import { h, html } from '../lib/dom.ts';
import { formatDate } from '../lib/format.ts';
import { loadManifest } from '../data/loaders.ts';
import { currentTheme, onThemeChange, toggleTheme } from './theme.ts';

export const NAV = [
  { href: '#/', label: 'Map', match: /^$/ },
  { href: '#/stories', label: 'Stories', match: /^\/stories/ },
  { href: '#/compare', label: 'Compare', match: /^\/compare/ },
  { href: '#/courtroom', label: 'Courtroom', match: /^\/courtroom/ },
  { href: '#/learn', label: 'Learn', match: /^\/learn/ },
  { href: '#/search', label: 'Search', match: /^\/search/ },
];

const SUN = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="3.6"/><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M15.9 12.6A6.6 6.6 0 0 1 7.4 4.1a.5.5 0 0 0-.7-.6 7.4 7.4 0 1 0 9.8 9.8.5.5 0 0 0-.6-.7Z" fill="currentColor"/></svg>';
const MENU = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h14M3 10h14M3 14h14"/></svg>';
const CLOSE = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5 5 15"/></svg>';

export interface Shell {
  main: HTMLElement;
  setActive(path: string): void;
}

export function buildShell(root: HTMLElement): Shell {
  const skip = h('a', { class: 'skip-link', href: '#main' }, 'Skip to content');
  const main = h('main', { id: 'main', class: 'site-main', tabindex: '-1' });
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    main.focus();
  });

  const mark = h('span', { class: 'wordmark__mark', 'aria-hidden': 'true' }, ...[0, 1, 2, 3, 4].map((i) => h('span', { class: `q${i}` })));
  const wordmark = h('a', { class: 'wordmark', href: '#/' }, mark, h('span', { class: 'wordmark__text' }, 'The Federal Courts Atlas'));

  const links = NAV.map((n) => h('a', { class: 'site-nav__link', href: n.href }, n.label));
  const list = h('ul', { class: 'site-nav__list', id: 'site-nav-list' }, ...links.map((a) => h('li', null, a)));
  const menuBtn = h('button', { type: 'button', class: 'site-nav__toggle', 'aria-expanded': 'false', 'aria-controls': 'site-nav-list', 'aria-label': 'Open menu' }, html(MENU));
  const setMenu = (open: boolean) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menuBtn.replaceChildren(html(open ? CLOSE : MENU));
    document.body.classList.toggle('menu-open', open);
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  list.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuBtn.focus();
    }
  });
  const nav = h('nav', { class: 'site-nav', 'aria-label': 'Main' }, menuBtn, list);

  const themeBtn = h('button', { type: 'button', class: 'theme-toggle' });
  const syncTheme = () => {
    const dark = currentTheme() === 'dark';
    themeBtn.replaceChildren(html(dark ? SUN : MOON));
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    themeBtn.title = dark ? 'Light theme' : 'Dark theme';
  };
  themeBtn.addEventListener('click', () => toggleTheme());
  onThemeChange(syncTheme);
  syncTheme();

  const header = h('header', { class: 'site-header' }, h('div', { class: 'site-header__inner' }, wordmark, nav, themeBtn));

  const build = h('span', { class: 'site-footer__build num' }, 'Data build: not yet published');
  const footer = h(
    'footer',
    { class: 'site-footer' },
    h(
      'div',
      { class: 'site-footer__inner' },
      h(
        'div',
        { class: 'site-footer__about' },
        h('p', { class: 'site-footer__brand' }, 'The Federal Courts Atlas'),
        h(
          'p',
          { class: 'site-footer__note' },
          'Every number in the atlas comes from a cited public source. Where a value could not be sourced, the atlas says “No data” rather than estimating it.',
        ),
      ),
      h(
        'ul',
        { class: 'site-footer__links' },
        h('li', null, h('a', { href: '#/sources' }, 'Sources')),
        h('li', null, h('a', { href: '#/sources?section=methodology' }, 'Methodology')),
        h('li', null, h('a', { href: '#/learn' }, 'How federal courts work')),
        h('li', null, h('a', { href: '#/search' }, 'Find your federal court')),
      ),
      build,
    ),
  );

  root.replaceChildren(skip, header, main, footer);

  void loadManifest().then((r) => {
    if (r.status === 'ok' && (r.data.build_date || r.data.version)) {
      build.textContent = `Data build: ${[r.data.version, r.data.build_date ? formatDate(r.data.build_date) : ''].filter(Boolean).join(' · ')}`;
    }
  });

  return {
    main,
    setActive(path: string) {
      NAV.forEach((n, i) => {
        const a = links[i]!;
        if (n.match.test(path)) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    },
  };
}
