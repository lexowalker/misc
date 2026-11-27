"""Polite, cached HTTP fetching for every pipeline lane.

Rules (from the project brief):
  * Cache every response to disk so nothing is fetched twice.
  * Respect free-tier limits; back off on 429/503 instead of retrying in a loop.
  * Never send personal details to outside services.

Usage::

    from pipeline.common.http import fetch, fetch_json
    path = fetch("https://www.fjc.gov/sites/default/files/history/judges.csv")
    data = fetch_json("https://www.courtlistener.com/api/rest/v4/courts/", params={"id": "vaed"})

``fetch`` returns a ``CachedResponse`` whose ``.path`` is the cached body on disk and
``.meta`` holds url, final_url, status, content_type, retrieved_at (UTC ISO), sha256, size.
"""
from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlparse

import requests

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = PROJECT_ROOT / "data" / "raw" / "http"
USER_AGENT = "FederalCourtsAtlas/0.1 (non-commercial public-data research; python-requests)"

# Minimum seconds between requests to the same host.
HOST_INTERVAL = {
    "nominatim.openstreetmap.org": 1.1,   # policy: max 1 req/s
    "www.courtlistener.com": 0.8,         # 5,000/hour on the free tier
    "geocoding.geo.census.gov": 0.25,
    "api.census.gov": 0.25,
}
DEFAULT_INTERVAL = 0.5
MAX_ATTEMPTS = 5

_last_hit: dict[str, float] = {}
_lock = threading.Lock()


class FetchError(RuntimeError):
    pass


@dataclass
class CachedResponse:
    path: Path
    meta: dict

    @property
    def text(self) -> str:
        return self.path.read_text(encoding=self.meta.get("encoding") or "utf-8", errors="replace")

    def json(self):
        return json.loads(self.path.read_text(encoding="utf-8"))


def _full_url(url: str, params: dict | None) -> str:
    if not params:
        return url
    sep = "&" if "?" in url else "?"
    return url + sep + urlencode(sorted(params.items()), doseq=True)


def _cache_paths(full_url: str, method: str = "GET", body_key: str = "") -> tuple[Path, Path]:
    host = urlparse(full_url).netloc or "unknown"
    key = hashlib.sha256(f"{method} {full_url} {body_key}".encode()).hexdigest()[:24]
    suffix = Path(urlparse(full_url).path).suffix[:8] or ".bin"
    d = CACHE_DIR / host
    return d / f"{key}{suffix}", d / f"{key}.meta.json"


def _throttle(host: str) -> None:
    interval = HOST_INTERVAL.get(host, DEFAULT_INTERVAL)
    with _lock:
        wait = _last_hit.get(host, 0) + interval - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_hit[host] = time.monotonic()


def _auth_headers(host: str) -> dict:
    if host == "www.courtlistener.com":
        # The cloud proxy injects the real token; locally, COURTLISTENER_API_TOKEN is used.
        tok = os.environ.get("COURTLISTENER_API_TOKEN") or "proxy-injected"
        return {"Authorization": f"Token {tok}"}
    return {}


def fetch(url: str, params: dict | None = None, *, method: str = "GET", data: dict | None = None,
          headers: dict | None = None, refresh: bool = False, timeout: int = 120,
          allow_status: tuple[int, ...] = ()) -> CachedResponse:
    """Fetch ``url`` (with optional query ``params``) through the on-disk cache.

    Large files are streamed. 429/503/5xx responses back off exponentially (honouring
    Retry-After) for at most MAX_ATTEMPTS, then raise FetchError. Non-2xx statuses other
    than those in ``allow_status`` raise FetchError (and are not cached).
    """
    full = _full_url(url, params)
    body_key = json.dumps(data, sort_keys=True) if data else ""
    body_path, meta_path = _cache_paths(full, method, body_key)
    if not refresh and body_path.exists() and meta_path.exists():
        return CachedResponse(body_path, json.loads(meta_path.read_text()))

    host = urlparse(full).netloc
    hdrs = {"User-Agent": USER_AGENT, **_auth_headers(host), **(headers or {})}
    body_path.parent.mkdir(parents=True, exist_ok=True)
    delay = 2.0
    last_err = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        _throttle(host)
        try:
            with requests.request(method, full, data=data, headers=hdrs, timeout=timeout,
                                  stream=True, allow_redirects=True) as r:
                if r.status_code in (429, 502, 503, 504):
                    ra = r.headers.get("Retry-After")
                    wait = float(ra) if ra and ra.isdigit() else delay
                    last_err = f"HTTP {r.status_code}"
                    time.sleep(min(wait, 300))
                    delay *= 2
                    continue
                if not (200 <= r.status_code < 300) and r.status_code not in allow_status:
                    raise FetchError(f"HTTP {r.status_code} for {full}")
                h = hashlib.sha256()
                size = 0
                tmp = body_path.with_suffix(body_path.suffix + ".part")
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1 << 20):
                        f.write(chunk)
                        h.update(chunk)
                        size += len(chunk)
                tmp.replace(body_path)
                meta = {
                    "url": full, "final_url": r.url, "method": method, "status": r.status_code,
                    "content_type": r.headers.get("Content-Type"), "encoding": r.encoding,
                    "last_modified": r.headers.get("Last-Modified"),
                    "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "sha256": h.hexdigest(), "size": size,
                }
                meta_path.write_text(json.dumps(meta, indent=1))
                return CachedResponse(body_path, meta)
        except requests.RequestException as e:  # network hiccup: back off and retry
            last_err = repr(e)
            time.sleep(delay)
            delay *= 2
    raise FetchError(f"giving up on {full} after {MAX_ATTEMPTS} attempts: {last_err}")


def fetch_json(url: str, params: dict | None = None, **kw):
    return fetch(url, params, headers={"Accept": "application/json", **kw.pop("headers", {})}, **kw).json()


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()
