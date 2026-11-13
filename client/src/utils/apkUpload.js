import { API_BASE } from '../config';
import { messageForStatus } from './http';

// Upload a big APK in small pieces (default 700 KB), one request each. This avoids any request-size limit
// on the host's front server, shows real progress, retries a bad piece, and halves the piece size if the
// server answers 413 (remembered for a week). The server stores pieces in order and checks the APK at the end.
const KEY = 'cttw_apk_chunk_v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_CHUNK = 700 * 1024;
const MIN_CHUNK = 48 * 1024;

const getChunk = () => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && Number.isFinite(s.bytes) && Date.now() - s.at < TTL_MS) return Math.min(DEFAULT_CHUNK, Math.max(MIN_CHUNK, s.bytes));
  } catch { /* use default */ }
  return DEFAULT_CHUNK;
};
const saveChunk = (bytes) => { try { localStorage.setItem(KEY, JSON.stringify({ bytes, at: Date.now() })); } catch { /* ignore */ } };

const abortError = () => { const e = new Error('Cancelled'); e.name = 'AbortError'; return e; };
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(abortError()); }, { once: true });
});

async function api(path, { method = 'GET', token, json, body, signal } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  let payload = body;
  if (json) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(json); }
  else if (body) headers['Content-Type'] = 'application/octet-stream';
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    const err = new Error('Could not reach the server. Check your internet connection.');
    err.network = true;
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) {
    const err = new Error((data && typeof data.error === 'string' && data.error) || messageForStatus(res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// onProgress(0..1), onNote(text) for things the admin should know (smaller pieces, retrying)
export async function uploadApk({ token, file, versionName, notes, onProgress, onNote, signal }) {
  const init = await api('/app/uploads', { method: 'POST', token, signal, json: { fileName: file.name, size: file.size, versionName, notes } });
  const uploadId = init.uploadId;
  let chunk = Math.min(getChunk(), init.chunkMax);
  let offset = 0;
  let failures = 0;
  try {
    while (offset < file.size) {
      if (signal?.aborted) throw abortError();
      const piece = file.slice(offset, Math.min(file.size, offset + chunk));
      try {
        // eslint-disable-next-line no-await-in-loop
        const r = await api(`/app/uploads/${uploadId}?offset=${offset}`, { method: 'PUT', token, body: piece, signal });
        offset = r.received;
        failures = 0;
        onProgress?.(offset / file.size);
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        if (err.status === 409 && err.data && Number.isInteger(err.data.received)) { offset = err.data.received; continue; }   // the server's position wins
        if (err.status === 413 && chunk > MIN_CHUNK) {
          chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 2));
          saveChunk(chunk);
          onNote?.(`The server limits request size, so the upload now sends smaller pieces (${Math.round(chunk / 1024)} KB).`);
          continue;
        }
        const retryable = err.network || err.status >= 500 || err.status === 429 || err.status === 408;
        failures += 1;
        if (!retryable || failures > 5) throw err;
        onNote?.('Connection problem, retrying...');
        // eslint-disable-next-line no-await-in-loop
        await sleep(Math.min(8000, 500 * 2 ** failures), signal);
        try { offset = (await api(`/app/uploads/${uploadId}`, { token, signal })).received; } catch { /* keep going from where we are */ }
      }
    }
    return await api(`/app/uploads/${uploadId}/complete`, { method: 'POST', token, signal });
  } catch (err) {
    // Best effort: do not leave a half-finished upload on the server
    fetch(`${API_BASE}/app/uploads/${uploadId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    throw err;
  }
}
