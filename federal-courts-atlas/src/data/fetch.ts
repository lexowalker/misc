// Fetch layer: relative to the deployed base (works from any subpath), cached per
// URL, and never throws. A 404 (or an HTML fallback page served in place of JSON)
// becomes { status: 'missing' } so the UI can show a designed "Data not yet built" state.

import type { Loaded } from './types.ts';

const cache = new Map<string, Promise<Loaded<unknown>>>();

/** Resolve a path under public/data/ against the app's base URL. */
export function dataUrl(path: string): string {
  const base = import.meta.env.BASE_URL || './';
  return `${base}${base.endsWith('/') ? '' : '/'}data/${path.replace(/^\/+/, '')}`;
}

async function doFetch<T>(url: string): Promise<Loaded<T>> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (e) {
    return { status: 'error', url, error: e instanceof Error ? e.message : String(e) };
  }
  if (res.status === 404 || res.status === 410) return { status: 'missing', url };
  if (!res.ok) return { status: 'error', url, error: `HTTP ${res.status}` };
  const type = res.headers.get('content-type') ?? '';
  // Dev servers and some static hosts answer unknown paths with index.html.
  if (type.includes('text/html')) return { status: 'missing', url };
  try {
    const data = (await res.json()) as T;
    return { status: 'ok', data, url };
  } catch (e) {
    return { status: 'error', url, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Fetch JSON from public/data/<path>, cached for the session. */
export function loadJson<T>(path: string): Promise<Loaded<T>> {
  const url = dataUrl(path);
  let p = cache.get(url) as Promise<Loaded<T>> | undefined;
  if (!p) {
    p = doFetch<T>(url);
    cache.set(url, p as Promise<Loaded<unknown>>);
    // Do not cache transient network errors; a later call may succeed.
    p.then((r) => {
      if (r.status === 'error') cache.delete(url);
    });
  }
  return p;
}

/** Map a Loaded<T> into Loaded<U> without losing the status. */
export async function mapLoaded<T, U>(p: Promise<Loaded<T>>, fn: (t: T) => U): Promise<Loaded<U>> {
  const r = await p;
  if (r.status !== 'ok') return r;
  try {
    return { status: 'ok', url: r.url, data: fn(r.data) };
  } catch (e) {
    return { status: 'error', url: r.url, error: e instanceof Error ? e.message : String(e) };
  }
}

export function isOk<T>(r: Loaded<T>): r is { status: 'ok'; data: T; url: string } {
  return r.status === 'ok';
}
