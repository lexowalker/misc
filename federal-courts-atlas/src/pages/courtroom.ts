// The Courtroom (#/courtroom): a three.js federal district courtroom. Choosing a seat (in the
// room, on the floating labels, or from the accessible seat list) moves the camera to that
// seat's point of view and fills the panel with the role and real atlas figures for the
// district the reader picks (national figures by default, where published).
//
// three.js loads only here: src/courtroom/scene.ts is imported dynamically and itself does
// `await import('three')`. Without WebGL (or with ?webgl=0) a 2D floor plan replaces the
// scene, and the seat list and panel work the same.
//
// URL state: ?seat=<seat id>&d=<district id>.

import '../styles/pages.css';
import '../styles/courtroom.css';
import { h, prefersReducedMotion } from '../lib/dom.ts';
import { replaceQuery, type Cleanup, type PageContext } from '../app/router.ts';
import { currentTheme, onThemeChange } from '../app/theme.ts';
import { DISTRICTS, districtName, isDistrictId } from '../data/districts.ts';
import { pageHead } from './_page.ts';
import { loadingState } from '../components/states.ts';
import { hidePopover } from '../components/glossary.ts';
import { ensureFormulaPopovers } from '../components/source-chip.ts';
import { SEATS, SEAT_BY_ID, isSeatId, type SeatId } from '../courtroom/seats.ts';
import { districtSelect, renderPanelBody } from '../courtroom/panel.ts';
import { createFloorPlan, type FloorPlan } from '../courtroom/plan.ts';
import type { CourtroomScene, ScenePalette } from '../courtroom/scene.ts';

export const title = 'The Courtroom';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function readPalette(el: HTMLElement): ScenePalette {
  const cs = getComputedStyle(el);
  const g = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    theme: currentTheme(),
    wood: g('--cr-wood', '#7a4a2b'),
    woodLight: g('--cr-wood-light', '#a26d3e'),
    woodDark: g('--cr-wood-dark', '#5a3520'),
    leather: g('--cr-leather', '#28335f'),
    carpet: g('--cr-carpet', '#34427c'),
    wall: g('--cr-wall', '#ebe6dd'),
    ceiling: g('--cr-ceiling', '#f2efe9'),
    brass: g('--cr-brass', '#b8915a'),
    glass: g('--cr-glass', '#e4ecff'),
    metal: g('--cr-metal', '#2a2e38'),
    paper: g('--cr-paper', '#f6f3ec'),
    poche: g('--cr-poche', '#1a2a6c'),
    slab: g('--cr-slab', '#d9dce4'),
    highlight: g('--cr-highlight', '#4b62d6'),
    lamp: g('--cr-lamp', '#fff1d2'),
  };
}

const SHEET_MQ = '(max-width: 959.98px)';

export function render(ctx: PageContext): Cleanup {
  let disposed = false;
  let scene: CourtroomScene | null = null;
  let plan: FloorPlan | null = null;
  const qSeat = ctx.query.get('seat');
  const qDistrict = ctx.query.get('d');
  const state: { seat: SeatId | null; district: string | null } = {
    seat: isSeatId(qSeat) ? qSeat : null,
    district: qDistrict && isDistrictId(qDistrict) ? qDistrict : null,
  };
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const sheetMq = typeof matchMedia === 'function' ? matchMedia(SHEET_MQ) : null;

  const page = h('div', { class: 'page courtroom-page' });
  const head = pageHead({
    kicker: 'Explore',
    title: 'The Courtroom',
    dek: 'Step inside a federal district courtroom. Choose a seat to see the room from there, and to see what the atlas’s data says about that part of the court in the district you pick.',
    className: 'cr-head',
  });

  /* ---- Stage ------------------------------------------------------------------------------- */
  const gl = h('div', { class: 'cr-stage__gl' });
  const pins = h('div', { class: 'cr-pins', 'aria-hidden': 'true', 'data-visible': 'false' });
  const where = h('p', { class: 'cr-stage__where', 'aria-hidden': 'true' });
  const back = h(
    'button',
    { type: 'button', class: 'cr-back', hidden: true },
    h('span', { 'aria-hidden': 'true', class: 'cr-back__icon' }, '←'),
    ' Room view',
  );
  const hint = h('p', { class: 'cr-hint', 'aria-hidden': 'true' });
  const loading = h('div', { class: 'cr-stage__loading' }, loadingState('Building the courtroom'));
  const stage = h(
    'div',
    { class: 'cr-stage', 'data-renderer': 'loading', 'data-mode': 'overview', 'data-arrived': 'overview' },
    gl,
    pins,
    h('div', { class: 'cr-stage__ui' }, back, where),
    hint,
    loading,
  );
  const fallbackNote = h('p', { class: 'cr-fallback-note', role: 'note', hidden: true });

  /* ---- Seat list --------------------------------------------------------------------------- */
  const overviewBtn = h(
    'button',
    { type: 'button', class: 'cr-seat cr-seat--room', 'aria-pressed': 'true', 'data-seat': '' },
    h('span', { class: 'cr-seat__n', 'aria-hidden': 'true' }, '◱'),
    h('span', { class: 'cr-seat__name' }, 'Room view'),
  );
  const seatBtns = new Map<SeatId, HTMLButtonElement>();
  const list = h('ol', { class: 'cr-seats__list' }, h('li', null, overviewBtn));
  SEATS.forEach((s, i) => {
    const b = h(
      'button',
      { type: 'button', class: 'cr-seat', 'aria-pressed': 'false', 'aria-controls': 'cr-panel', 'data-seat': s.id },
      h('span', { class: 'cr-seat__n', 'aria-hidden': 'true' }, String(i + 1)),
      h('span', { class: 'cr-seat__name' }, s.name),
    );
    seatBtns.set(s.id, b);
    list.append(h('li', null, b));
  });
  const seatsNav = h(
    'nav',
    { class: 'cr-seats', 'aria-labelledby': 'cr-seats-title' },
    h('h2', { class: 'cr-seats__title', id: 'cr-seats-title' }, 'Seats in the courtroom'),
    h('p', { class: 'cr-seats__help', id: 'cr-seats-help' }, 'Choose a seat to sit there. Arrow keys move between seats.'),
    list,
  );

  /* ---- Panel ------------------------------------------------------------------------------- */
  const sheetHandle = h(
    'button',
    { type: 'button', class: 'cr-sheet__handle', 'aria-expanded': 'false', 'aria-label': 'Show more of the panel' },
    h('span', { class: 'cr-sheet__grip', 'aria-hidden': 'true' }),
  );
  const sheetClose = h('button', { type: 'button', class: 'cr-sheet__close', 'aria-label': 'Close the panel and return to the room view' }, h('span', { 'aria-hidden': 'true' }, '×'));
  const select = districtSelect(state.district, (id) => setDistrict(id), DISTRICTS.map((d) => d.id));
  const profileLink = h('a', { class: 'cr-picker__link', href: '#/' }, '');
  const picker = h(
    'div',
    { class: 'cr-picker' },
    h('label', { class: 'cr-picker__label', for: 'cr-district' }, 'Figures for'),
    h('div', { class: 'select-wrap cr-picker__wrap' }, select),
    h('p', { class: 'cr-picker__help', id: 'cr-district-help' }, profileLink),
  );
  const body = h('div', { class: 'cr-panel__body' });
  const panel = h(
    'section',
    { class: 'cr-panel', id: 'cr-panel', 'aria-label': 'Seat details and figures', 'data-sheet': 'closed' },
    h('div', { class: 'cr-sheet__bar' }, sheetHandle, sheetClose),
    h('div', { class: 'cr-panel__scroll' }, picker, body),
  );
  const live = h('p', { class: 'visually-hidden', 'aria-live': 'polite', role: 'status' });

  page.append(
    head,
    h('div', { class: 'cr-layout' }, h('div', { class: 'cr-main' }, stage, fallbackNote, seatsNav), panel),
    live,
  );
  ctx.root.append(page);

  /* ---- Behavior ---------------------------------------------------------------------------- */

  function updateProfileLink(): void {
    if (state.district) {
      profileLink.textContent = `Open the ${districtName(state.district)} profile`;
      profileLink.setAttribute('href', `#/district/${state.district}`);
      profileLink.hidden = false;
    } else {
      profileLink.textContent = '';
      profileLink.hidden = true;
    }
  }

  function updateChrome(): void {
    const s = state.seat ? SEAT_BY_ID.get(state.seat)! : null;
    overviewBtn.setAttribute('aria-pressed', String(!s));
    seatBtns.forEach((b, id) => b.setAttribute('aria-pressed', String(id === state.seat)));
    back.hidden = !s;
    where.textContent = s ? `Seated: ${s.name.replace(/^The /, 'the ')}` : '';
    where.hidden = !s;
    stage.dataset.mode = s ? 'pov' : 'overview';
    stage.dataset.seat = s?.id ?? '';
    hint.textContent = s
      ? touch
        ? 'Drag to look around. Tap another seat to move.'
        : 'Drag to look around. Click another seat to move.'
      : touch
        ? 'Drag to turn the room. Tap a seat to sit there.'
        : 'Drag to turn the room. Click a seat to sit there.';
    const sheet = !!s && !!sheetMq?.matches;
    panel.dataset.sheet = sheet ? 'open' : 'closed';
    page.dataset.sheet = sheet ? 'open' : 'closed';
    if (!sheet) {
      panel.dataset.expanded = 'false';
      sheetHandle.setAttribute('aria-expanded', 'false');
    }
  }

  async function refreshPanel(focusTitle = false): Promise<void> {
    const s = state.seat ? SEAT_BY_ID.get(state.seat)! : null;
    const seatAtStart = state.seat;
    await renderPanelBody(body, { seat: s, district: state.district });
    if (disposed || state.seat !== seatAtStart) return;
    if (focusTitle) body.querySelector<HTMLElement>('#cr-panel-title')?.focus({ preventScroll: !panel.matches('[data-sheet="open"]') });
  }

  type Source = 'list' | 'scene' | 'plan' | 'url' | 'escape' | 'close';
  function selectSeat(id: SeatId | null, from: Source, keyboard = false): void {
    if (disposed) return;
    const prev = state.seat;
    state.seat = id;
    hidePopover();
    replaceQuery({ seat: id });
    updateChrome();
    void refreshPanel(keyboard && !!id);
    if (scene) scene.goTo(id, { instant: from === 'url' });
    plan?.select(id);
    if (id) {
      const s = SEAT_BY_ID.get(id)!;
      live.textContent = `${s.name}. The view moved to this seat, and the panel shows its figures.`;
      if (sheetMq?.matches && from !== 'url') {
        // Bring the room view to the top of the screen, above the sheet.
        const header = document.querySelector<HTMLElement>('.site-header');
        const top = stage.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight ?? 0) - 8;
        window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    } else {
      live.textContent = 'Room view.';
      if ((from === 'escape' || from === 'close') && prev) (seatBtns.get(prev) ?? overviewBtn).focus({ preventScroll: true });
    }
  }

  function setDistrict(id: string | null): void {
    state.district = id;
    replaceQuery({ d: id });
    updateProfileLink();
    live.textContent = id ? `Figures for the ${districtName(id)}.` : 'National figures.';
    void refreshPanel(false);
  }

  // Seat list: click (keyboard activation moves focus to the panel heading), arrow keys, hover sync.
  const allBtns = (): HTMLButtonElement[] => [overviewBtn, ...seatBtns.values()];
  list.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button.cr-seat');
    if (!b) return;
    const id = b.dataset.seat || null;
    selectSeat(isSeatId(id) ? id : null, 'list', (e as MouseEvent).detail === 0);
  });
  list.addEventListener('keydown', (e) => {
    const btns = allBtns();
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    let j = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % btns.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + btns.length) % btns.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = btns.length - 1;
    if (j >= 0) {
      e.preventDefault();
      btns[j]!.focus();
    }
  });
  list.addEventListener('pointerover', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button.cr-seat');
    const id = b?.dataset.seat;
    const sid = isSeatId(id) ? id : null;
    scene?.setHover(sid);
    plan?.setHover(sid);
  });
  list.addEventListener('pointerleave', () => {
    scene?.setHover(null);
    plan?.setHover(null);
  });
  const markListHover = (id: SeatId | null) => seatBtns.forEach((b, sid) => b.classList.toggle('is-hover', sid === id));

  back.addEventListener('click', () => selectSeat(null, 'close'));
  sheetClose.addEventListener('click', () => selectSeat(null, 'close'));
  sheetHandle.addEventListener('click', () => {
    const open = panel.dataset.expanded !== 'true';
    panel.dataset.expanded = String(open);
    sheetHandle.setAttribute('aria-expanded', String(open));
    sheetHandle.setAttribute('aria-label', open ? 'Show less of the panel' : 'Show more of the panel');
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !state.seat) return;
    if (document.querySelector('.gloss-pop[data-open="true"]')) return; // the glossary closes first
    const t = e.target as Element | null;
    if (t?.closest?.('select, input, textarea')) return;
    selectSeat(null, 'escape');
  };
  window.addEventListener('keydown', onKey, true);
  const onMq = () => updateChrome();
  sheetMq?.addEventListener('change', onMq);

  // Formula and rank popovers: open on tap or click too, close on Escape or an outside click (shared handler in
  // source-chip.ts; hover and keyboard focus are handled in CSS).
  ensureFormulaPopovers();

  // The sticky panel sits below the sticky site header.
  const header = document.querySelector<HTMLElement>('.site-header');
  if (header) page.style.setProperty('--header-h', `${header.offsetHeight}px`);

  /* ---- Renderer: WebGL scene or floor plan ------------------------------------------------- */

  function mountFallback(reason: 'unsupported' | 'error' | 'forced' | 'lost'): void {
    if (disposed || plan) return;
    scene?.dispose();
    scene = null;
    loading.remove();
    gl.replaceChildren();
    pins.replaceChildren();
    stage.dataset.renderer = 'fallback';
    plan = createFloorPlan(
      (id) => selectSeat(id, 'plan'),
      (id) => markListHover(id),
    );
    plan.select(state.seat);
    gl.append(plan.el);
    fallbackNote.hidden = false;
    fallbackNote.textContent =
      reason === 'forced'
        ? 'Showing the floor plan instead of the 3D room. Choose a seat on the plan or from the list.'
        : reason === 'lost'
          ? 'The 3D view stopped working, so here is a floor plan of the room. Choose a seat on the plan or from the list.'
          : 'This browser cannot show the 3D room, so here is a floor plan. Choose a seat on the plan or from the list.';
    stage.dataset.ready = 'true';
  }

  const forced = ctx.query.get('webgl') === '0';
  if (forced) mountFallback('forced');
  else if (!hasWebGL()) mountFallback('unsupported');
  else {
    import('../courtroom/scene.ts')
      .then((m) =>
        m.createCourtroomScene({
          container: gl,
          pinLayer: pins,
          palette: () => readPalette(page),
          onPick: (id) => selectSeat(id, 'scene'),
          onHover: (id) => markListHover(id),
          onArrive: (id) => {
            stage.dataset.arrived = id ?? 'overview';
          },
          onContextLost: () => mountFallback('lost'),
          reducedMotion: prefersReducedMotion,
          preserveDrawingBuffer: navigator.webdriver === true,
        }),
      )
      .then((sc) => {
        if (disposed) {
          sc.dispose();
          return;
        }
        scene = sc;
        stage.dataset.renderer = 'webgl';
        loading.remove();
        if (state.seat) sc.goTo(state.seat, { instant: true });
        requestAnimationFrame(() => requestAnimationFrame(() => (stage.dataset.ready = 'true')));
      })
      .catch((err: unknown) => {
        console.warn('Courtroom: 3D view unavailable, showing the floor plan.', err);
        mountFallback('error');
      });
  }

  const offTheme = onThemeChange(() => {
    // Wait a frame so the new theme's custom properties are in effect.
    requestAnimationFrame(() => scene?.refreshTheme());
  });

  updateProfileLink();
  updateChrome();
  void refreshPanel(false);

  return () => {
    disposed = true;
    window.removeEventListener('keydown', onKey, true);
    sheetMq?.removeEventListener('change', onMq);
    offTheme();
    scene?.dispose();
    scene = null;
    plan = null;
  };
}
