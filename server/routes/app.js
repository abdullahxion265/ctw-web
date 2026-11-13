const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { downloadLimits } = require('../middleware/apkLimiter');

const router = express.Router();
const fsp = fs.promises;

// Express 4 does not catch errors from async handlers: pass them on so the client gets a JSON 500, not a hang
['get', 'post', 'put', 'delete'].forEach((method) => {
  const original = router[method].bind(router);
  router[method] = (route, ...handlers) => original(route, ...handlers.map((h) => (
    typeof h === 'function' && h.constructor.name === 'AsyncFunction' ? (req, res, next) => h(req, res, next).catch(next) : h
  )));
});

// Where files live. Never served statically: customers can only get the APK through /download (rate limited).
const APK_DIR = path.join(__dirname, '..', 'apk');
const TMP_DIR = path.join(APK_DIR, 'tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

const MAX_MB = parseInt(process.env.APK_MAX_MB, 10) || 200;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const MIN_BYTES = 100 * 1024;
const CHUNK_MAX = 1024 * 1024;                 // one piece per request, small enough for proxy body limits
const KEEP_RELEASES = parseInt(process.env.APK_KEEP_RELEASES, 10) || 5;
const STALE_MS = 24 * 60 * 60 * 1000;

const isId = (s) => /^[a-f0-9]{32}$/.test(s || '');
const slug = (v) => v.replace(/[^A-Za-z0-9._-]+/g, '-');
const partPath = (id) => path.join(TMP_DIR, `${id}.part`);
const metaPath = (id) => path.join(TMP_DIR, `${id}.json`);
const removeFile = (p) => fsp.unlink(p).catch(() => {});

// One request at a time per upload
const locks = new Map();
async function withLock(id, fn) {
  const prev = locks.get(id) || Promise.resolve();
  let release;
  const gate = new Promise((r) => { release = r; });
  const tail = prev.then(() => gate);
  locks.set(id, tail);
  await prev;
  try { return await fn(); } finally { release(); if (locks.get(id) === tail) locks.delete(id); }
}

async function readMeta(id) {
  try { return JSON.parse(await fsp.readFile(metaPath(id), 'utf8')); } catch { return null; }
}

// A real APK is a zip that contains AndroidManifest.xml (names are listed in the zip's index at the end).
async function checkApk(file, size) {
  const fh = await fsp.open(file, 'r');
  try {
    const head = Buffer.alloc(4);
    await fh.read(head, 0, 4, 0);
    if (head.toString('latin1') !== 'PK\x03\x04') return 'This file is not an APK (it is not a zip archive).';
    const tailLen = Math.min(size, 4 * 1024 * 1024);
    const tail = Buffer.alloc(tailLen);
    await fh.read(tail, 0, tailLen, size - tailLen);
    if (!tail.includes('AndroidManifest.xml')) return 'This file is not an Android APK (AndroidManifest.xml is missing).';
    return null;
  } finally {
    await fh.close();
  }
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (d) => hash.update(d)).on('error', reject).on('end', () => resolve(hash.digest('hex')));
  });
}

const publicRelease = (r) => ({
  id: r.id, version: r.version_name, notes: r.notes, size: Number(r.size_bytes), sha256: r.sha256,
  isCurrent: !!r.is_current, downloads: r.downloads, createdAt: r.created_at, originalName: r.original_name,
});

// Remove unfinished uploads older than a day
async function sweepStale() {
  try {
    const names = await fsp.readdir(TMP_DIR);
    const now = Date.now();
    await Promise.all(names.map(async (n) => {
      const p = path.join(TMP_DIR, n);
      const st = await fsp.stat(p).catch(() => null);
      if (st && now - st.mtimeMs > STALE_MS) await removeFile(p);
    }));
  } catch { /* ignore */ }
}
sweepStale();
setInterval(sweepStale, 60 * 60 * 1000).unref();

// Keep the newest releases (plus the current one), delete the rest
async function prune() {
  const [rows] = await db.query('SELECT id, file_name, is_current FROM app_releases ORDER BY created_at DESC, id DESC');
  const extra = rows.filter((r, i) => i >= KEEP_RELEASES && !r.is_current);
  for (const r of extra) {
    // eslint-disable-next-line no-await-in-loop
    await db.query('DELETE FROM app_releases WHERE id = ?', [r.id]);
    removeFile(path.join(APK_DIR, path.basename(r.file_name)));
  }
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

// GET /api/app/latest : details of the current release (or available: false)
router.get('/latest', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM app_releases WHERE is_current = 1 LIMIT 1');
    res.set('Cache-Control', 'no-cache');
    if (!rows.length) return res.json({ available: false });
    res.json({ available: true, ...publicRelease(rows[0]), downloadUrl: '/api/app/download' });
  } catch (err) {
    console.error('[GET /app/latest]', err.message);
    res.json({ available: false });   // the shop must keep working even if this table is missing
  }
});

// GET /api/app/download : the current APK, rate limited (see middleware/apkLimiter.js)
router.get('/download', ...downloadLimits, async (req, res) => {
  const wantsHtml = /text\/html/.test(req.headers.accept || '');
  const missing = () => (wantsHtml
    ? res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><title>Not available</title><body style="font-family:system-ui;background:#0D0D0D;color:#F5F5F7;padding:2rem">The app is not available for download right now. <a style="color:#D4AF37" href="/">Back to the shop</a></body>')
    : res.status(404).json({ error: 'The app is not available for download right now.' }));
  try {
    const [rows] = await db.query('SELECT * FROM app_releases WHERE is_current = 1 LIMIT 1');
    if (!rows.length) return missing();
    const rel = rows[0];
    const file = path.join(APK_DIR, path.basename(rel.file_name));
    if (!fs.existsSync(file)) { console.error('[apk] file missing on disk:', rel.file_name); return missing(); }

    if (!req.headers.range || /^bytes=0-/.test(req.headers.range)) {
      console.log(`[apk] download v${rel.version_name} from ${req.ip}`);
    }
    res.set('Content-Type', 'application/vnd.android.package-archive');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-cache');
    res.set('X-APK-SHA256', rel.sha256);
    res.on('finish', () => {
      if (res.statusCode === 200 && req.method === 'GET') {
        db.query('UPDATE app_releases SET downloads = downloads + 1 WHERE id = ?', [rel.id]).catch(() => {});
      }
    });
    return res.download(file, `CarterTheTownWear-${slug(rel.version_name)}.apk`, (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Download failed. Please try again.' });
    });
  } catch (err) {
    console.error('[GET /app/download]', err);
    return res.status(500).json({ error: 'Download failed. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Admin: chunked upload (many small requests, so proxy size limits never matter)
// ---------------------------------------------------------------------------
const admin = [requireAuth, requireAdmin];

// POST /api/app/uploads : start an upload
router.post('/uploads', ...admin, async (req, res) => {
  const { fileName, size, versionName, notes } = req.body || {};
  const version = String(versionName || '').trim();
  if (!/^[A-Za-z0-9._+\- ]{1,40}$/.test(version)) {
    return res.status(400).json({ error: 'Enter a version name such as 1.2.0 (letters, numbers, dots and dashes, up to 40 characters).' });
  }
  if (!/\.apk$/i.test(String(fileName || ''))) return res.status(400).json({ error: 'Choose a file ending in .apk.' });
  const bytes = Number(size);
  if (!Number.isInteger(bytes) || bytes < MIN_BYTES) return res.status(400).json({ error: 'That file is too small to be an APK.' });
  if (bytes > MAX_BYTES) return res.status(400).json({ error: `That file is too large. The limit is ${MAX_MB} MB.` });
  const cleanNotes = String(notes || '').trim().slice(0, 1000);

  const id = crypto.randomBytes(16).toString('hex');
  await fsp.writeFile(metaPath(id), JSON.stringify({ id, fileName: path.basename(String(fileName)), size: bytes, version, notes: cleanNotes }));
  await fsp.writeFile(partPath(id), '');
  return res.status(201).json({ uploadId: id, chunkMax: CHUNK_MAX, maxMb: MAX_MB });
});

// GET /api/app/uploads/:id : how much has arrived (for resuming)
router.get('/uploads/:id', ...admin, async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Upload not found' });
  const meta = await readMeta(req.params.id);
  if (!meta) return res.status(404).json({ error: 'Upload not found' });
  const st = await fsp.stat(partPath(meta.id)).catch(() => null);
  return res.json({ received: st ? st.size : 0, size: meta.size });
});

// PUT /api/app/uploads/:id?offset=N : one piece (raw bytes). Pieces must arrive in order; repeats are harmless.
router.put('/uploads/:id', ...admin, express.raw({ type: () => true, limit: CHUNK_MAX }), async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Upload not found' });
  const offset = Number(req.query.offset);
  if (!Number.isInteger(offset) || offset < 0) return res.status(400).json({ error: 'Invalid offset.' });
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!body.length) return res.status(400).json({ error: 'Empty piece.' });

  return withLock(req.params.id, async () => {
    const meta = await readMeta(req.params.id);
    if (!meta) return res.status(404).json({ error: 'Upload not found' });
    const st = await fsp.stat(partPath(meta.id)).catch(() => null);
    const have = st ? st.size : 0;
    if (offset < have) return res.json({ received: have });                       // already stored (a retry)
    if (offset > have) return res.status(409).json({ error: 'A piece is missing.', received: have });
    if (have + body.length > meta.size) return res.status(400).json({ error: 'More data than the file size announced.' });
    await fsp.appendFile(partPath(meta.id), body);
    return res.json({ received: have + body.length });
  });
});

// POST /api/app/uploads/:id/complete : check the file, store it and make it the current release
router.post('/uploads/:id/complete', ...admin, async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Upload not found' });
  return withLock(req.params.id, async () => {
    const meta = await readMeta(req.params.id);
    if (!meta) return res.status(404).json({ error: 'Upload not found' });
    const part = partPath(meta.id);
    const st = await fsp.stat(part).catch(() => null);
    const have = st ? st.size : 0;
    const discard = async () => { await removeFile(part); await removeFile(metaPath(meta.id)); };
    if (have !== meta.size) return res.status(409).json({ error: 'The file is incomplete.', received: have });

    const problem = await checkApk(part, have);
    if (problem) { await discard(); return res.status(400).json({ error: problem }); }

    const sha = await sha256File(part);
    const [dup] = await db.query('SELECT version_name FROM app_releases WHERE sha256 = ?', [sha]);
    if (dup.length) { await discard(); return res.status(409).json({ error: `This exact APK is already uploaded (version ${dup[0].version_name}).` }); }

    const finalName = `ctw-${slug(meta.version)}-${sha.slice(0, 8)}.apk`;
    await fsp.rename(part, path.join(APK_DIR, finalName));
    await removeFile(metaPath(meta.id));

    const conn = await db.getConnection();
    let releaseId;
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE app_releases SET is_current = 0');
      const [r] = await conn.query(
        'INSERT INTO app_releases (version_name, notes, file_name, original_name, size_bytes, sha256, is_current) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [meta.version, meta.notes || null, finalName, meta.fileName, have, sha]
      );
      releaseId = r.insertId;
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      await removeFile(path.join(APK_DIR, finalName));
      throw err;
    } finally {
      conn.release();
    }
    await prune().catch((e) => console.error('[apk] prune failed', e.message));
    const [rows] = await db.query('SELECT * FROM app_releases WHERE id = ?', [releaseId]);
    return res.status(201).json(publicRelease(rows[0]));
  });
});

// DELETE /api/app/uploads/:id : cancel an upload
router.delete('/uploads/:id', ...admin, async (req, res) => {
  if (isId(req.params.id)) { await removeFile(partPath(req.params.id)); await removeFile(metaPath(req.params.id)); }
  res.json({ message: 'Upload cancelled' });
});

// ---------------------------------------------------------------------------
// Admin: releases
// ---------------------------------------------------------------------------
router.get('/releases', ...admin, async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM app_releases ORDER BY created_at DESC, id DESC');
  res.json({ releases: rows.map(publicRelease), limits: { maxMb: MAX_MB, keep: KEEP_RELEASES } });
});

router.put('/releases/:id/current', ...admin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [rows] = await db.query('SELECT id FROM app_releases WHERE id = ?', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Release not found' });
  await db.query('UPDATE app_releases SET is_current = (id = ?)', [id]);
  return res.json({ message: 'Current release updated' });
});

router.delete('/releases/:id', ...admin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [rows] = await db.query('SELECT * FROM app_releases WHERE id = ?', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Release not found' });
  await db.query('DELETE FROM app_releases WHERE id = ?', [id]);
  removeFile(path.join(APK_DIR, path.basename(rows[0].file_name)));
  if (rows[0].is_current) {
    // the newest remaining release takes over
    await db.query('UPDATE app_releases SET is_current = 1 WHERE id = (SELECT id FROM (SELECT id FROM app_releases ORDER BY created_at DESC, id DESC LIMIT 1) t)');
  }
  return res.json({ message: 'Release deleted' });
});

module.exports = router;
