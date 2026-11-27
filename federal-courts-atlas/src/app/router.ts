// Hash router. Hash routing keeps dist/ deployable to any subpath on any static host.
// Each route lazy-loads its page module (code splitting), so the home map ships
// first and three.js only ever loads on #/courtroom.

export interface PageContext {
  root: HTMLElement;
  params: Record<string, string>;
  query: URLSearchParams;
  path: string;
}

export type Cleanup = () => void;

export interface PageModule {
  title?: string | ((ctx: PageContext) => string);
  render(ctx: PageContext): void | Cleanup | Promise<void | Cleanup>;
}

interface Route {
  name: string;
  pattern: RegExp;
  keys: string[];
  load: () => Promise<PageModule>;
}

function route(name: string, path: string, load: () => Promise<PageModule>): Route {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' +
      path.replace(/\/:([a-z]+)/gi, (_, k: string) => {
        keys.push(k);
        return '/([^/]+)';
      }) +
      '/?$',
  );
  return { name, pattern, keys, load };
}

export const ROUTES: Route[] = [
  route('home', '', () => import('../pages/home.ts')),
  route('district', '/district/:id', () => import('../pages/district.ts')),
  route('compare', '/compare', () => import('../pages/compare.ts')),
  route('stories', '/stories', () => import('../pages/stories.ts')),
  route('story', '/stories/:slug', () => import('../pages/story.ts')),
  route('courtroom', '/courtroom', () => import('../pages/courtroom.ts')),
  route('learn', '/learn', () => import('../pages/learn.ts')),
  route('search', '/search', () => import('../pages/search.ts')),
  route('sources', '/sources', () => import('../pages/sources.ts')),
  route('table', '/table/:variable', () => import('../pages/table.ts')),
];

export interface ParsedHash {
  path: string;
  query: URLSearchParams;
}

export function parseHash(hash = location.hash): ParsedHash {
  const raw = hash.replace(/^#/, '');
  const [p = '', q = ''] = raw.split('?');
  const path = p === '/' ? '' : p.replace(/\/+$/, '');
  return { path, query: new URLSearchParams(q) };
}

export function match(path: string): { route: Route; params: Record<string, string> } | null {
  for (const r of ROUTES) {
    const m = r.pattern.exec(path);
    if (m) {
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]!)));
      return { route: r, params };
    }
  }
  return null;
}

/** Update the query string of the current route without re-rendering the page. */
export function replaceQuery(params: Record<string, string | null | undefined>): void {
  const { path, query } = parseHash();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') query.delete(k);
    else query.set(k, v);
  }
  const qs = query.toString();
  history.replaceState(history.state, '', `#${path || '/'}${qs ? `?${qs}` : ''}`);
}

export function href(path: string, query?: Record<string, string>): string {
  const qs = query ? new URLSearchParams(query).toString() : '';
  return `#${path || '/'}${qs ? `?${qs}` : ''}`;
}
