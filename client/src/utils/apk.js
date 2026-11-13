import { useEffect, useState } from 'react';
import { API_BASE } from '../config';

export const APK_DOWNLOAD_URL = `${API_BASE}/app/download`;

// Details of the current Android release. Fetched once and shared, so the home page, footer and app page
// do not each ask the server. `null` while loading, then { available: false } or { available: true, ... }.
let cache = null;
let inflight = null;

export function loadLatestRelease(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch(`${API_BASE}/app/latest`)
      .then((r) => (r.ok ? r.json() : { available: false }))
      .catch(() => ({ available: false }))
      .then((d) => { cache = d; inflight = null; return d; });
  }
  return inflight;
}

export function resetLatestRelease() { cache = null; }

export function useLatestRelease() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    let on = true;
    loadLatestRelease().then((d) => { if (on) setData(d); });
    return () => { on = false; };
  }, []);
  return data;
}

export function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
