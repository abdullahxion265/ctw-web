import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Smartphone, Copy, Check, Trash2, AlertCircle, CheckCircle2, Loader2, FileUp } from 'lucide-react';
import { API_BASE } from '../config';
import { formatBytes } from '../utils/image';
import { uploadApk } from '../utils/apkUpload';
import { resetLatestRelease, formatDate } from '../utils/apk';

const labelStyle = {
  display: 'block', fontSize: '0.68rem', letterSpacing: '0.14em', color: 'var(--color-muted-gold)',
  textTransform: 'uppercase', marginBottom: '0.45rem', fontFamily: 'var(--font-mono)',
};

export default function ApkManager({ token, showToast }) {
  const [releases, setReleases] = useState(null);
  const [limits, setLimits] = useState({ maxMb: 200, keep: 5 });
  const [loadError, setLoadError] = useState('');
  const [file, setFile] = useState(null);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [copied, setCopied] = useState('');
  const abortRef = useRef(null);
  const fileRef = useRef(null);
  const auth = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/app/releases`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('load');
      const data = await res.json();
      setReleases(data.releases);
      if (data.limits) setLimits(data.limits);
      setLoadError('');
    } catch {
      setLoadError('Could not load the releases. Check the connection and refresh.');
      setReleases((r) => r || []);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const pageLink = `${window.location.origin}/app`;
  const copy = async (text, key) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1600); } catch { /* clipboard blocked */ }
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    setUploadError('');
    setErrors((x) => ({ ...x, file: undefined }));
    if (!f) return;
    if (!/\.apk$/i.test(f.name)) { setFile(null); setErrors((x) => ({ ...x, file: 'Choose a file that ends in .apk.' })); return; }
    if (f.size > limits.maxMb * 1024 * 1024) { setFile(null); setErrors((x) => ({ ...x, file: `That file is ${formatBytes(f.size)}. The limit is ${limits.maxMb} MB.` })); return; }
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const next = {};
    if (!file) next.file = 'Choose the APK file.';
    if (!/^[A-Za-z0-9._+\- ]{1,40}$/.test(version.trim())) next.version = 'Enter a version such as 1.2.0 (letters, numbers, dots and dashes).';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true); setProgress(0); setNote(''); setUploadError('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const rel = await uploadApk({
        token, file, versionName: version.trim(), notes: notes.trim(),
        onProgress: setProgress, onNote: setNote, signal: controller.signal,
      });
      resetLatestRelease();
      showToast?.(`Version ${rel.version} is now live.`);
      setFile(null); setVersion(''); setNotes(''); setNote('');
      await load();
    } catch (err) {
      if (err.name !== 'AbortError') setUploadError(err.message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const makeCurrent = async (r) => {
    const res = await fetch(`${API_BASE}/app/releases/${r.id}/current`, { method: 'PUT', headers: auth });
    if (res.ok) { resetLatestRelease(); showToast?.(`Version ${r.version} is now the download.`); load(); } else showToast?.('Could not change the current release.', 'error');
  };

  const remove = async (r) => {
    const warn = r.isCurrent ? ' It is the current download: the newest remaining release will take over, or the download disappears if there is none.' : '';
    if (!window.confirm(`Delete version ${r.version}? The file is removed from the server.${warn}`)) return;
    const res = await fetch(`${API_BASE}/app/releases/${r.id}`, { method: 'DELETE', headers: auth });
    if (res.ok) { resetLatestRelease(); showToast?.(`Version ${r.version} deleted.`); load(); } else showToast?.('Could not delete that release.', 'error');
  };

  const pct = Math.round(progress * 100);
  const current = (releases || []).find((r) => r.isCurrent);

  return (
    <div style={{ maxWidth: '760px' }}>
      <h2 className="font-display" style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--color-neutral-light)', marginBottom: '0.4rem' }}>Android app (APK)</h2>
      <p style={{ color: 'var(--color-muted-gray)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        Upload each new release here. Customers download it from the website and install it directly (sideloading). The newest upload becomes the download automatically.
      </p>

      {/* Public link */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.85rem 1rem', background: 'var(--color-secondary-dark)', border: '1px solid rgba(142,142,147,0.2)', borderRadius: '10px', marginBottom: '2rem' }}>
        <Smartphone size={18} style={{ color: 'var(--color-accent-gold)', flexShrink: 0 }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: '180px' }}>
          <p className="font-mono" style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: 'var(--color-muted-gray)', textTransform: 'uppercase' }}>Link to share</p>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-neutral-light)', wordBreak: 'break-all' }}>{pageLink}</p>
        </div>
        <button type="button" className="btn-outline-gold" style={{ padding: '0.5rem 0.9rem', fontSize: '0.76rem' }} onClick={() => copy(pageLink, 'link')}>
          {copied === 'link' ? <Check size={13} /> : <Copy size={13} />}<span>{copied === 'link' ? 'Copied' : 'Copy link'}</span>
        </button>
      </div>

      {/* Upload */}
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginBottom: '2.5rem' }}>
        <h3 className="font-display" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-neutral-light)' }}>Upload a new release</h3>

        <div>
          <span style={labelStyle}>APK file *</span>
          <input id="apk-file" ref={fileRef} type="file" accept=".apk,application/vnd.android.package-archive" onChange={onPick} style={{ display: 'none' }} />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1rem', cursor: busy ? 'default' : 'pointer',
              background: 'var(--color-secondary-dark)', borderRadius: '8px', color: 'var(--color-neutral-light)',
              border: `1px dashed ${errors.file ? 'rgba(239,68,68,0.7)' : 'rgba(212,175,55,0.45)'}`,
            }}>
            <FileUp size={20} style={{ color: 'var(--color-accent-gold)', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              {file
                ? <><span style={{ display: 'block', fontSize: '0.9rem', wordBreak: 'break-all' }}>{file.name}</span><span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-muted-gray)' }}>{formatBytes(file.size)}</span></>
                : <span style={{ fontSize: '0.9rem', color: 'var(--color-muted-gray)' }}>Choose the .apk file (up to {limits.maxMb} MB)</span>}
            </span>
          </button>
          {errors.file && <p className="pf-error-text" role="alert"><AlertCircle size={13} />{errors.file}</p>}
        </div>

        <div>
          <label htmlFor="apk-version" style={labelStyle}>Version name *</label>
          <input id="apk-version" className={`input-dark ${errors.version ? 'pf-input-error' : ''}`} placeholder="e.g. 1.2.0" maxLength={40}
            value={version} disabled={busy} onChange={(e) => { setVersion(e.target.value); setErrors((x) => ({ ...x, version: undefined })); }} autoComplete="off" />
          {errors.version && <p className="pf-error-text" role="alert"><AlertCircle size={13} />{errors.version}</p>}
        </div>

        <div>
          <label htmlFor="apk-notes" style={labelStyle}>What is new (optional)</label>
          <textarea id="apk-notes" className="input-dark" rows={3} maxLength={1000} placeholder="Short summary shown to customers"
            value={notes} disabled={busy} onChange={(e) => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
        </div>

        {uploadError && (
          <div role="alert" style={{ display: 'flex', gap: '0.6rem', padding: '0.75rem 0.9rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', color: '#f87171', fontSize: '0.86rem', lineHeight: 1.45 }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} /><span>{uploadError}</span>
          </div>
        )}

        {busy ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-neutral-light)', marginBottom: '0.4rem' }}>
              <span>{pct >= 100 ? 'Checking the file...' : 'Uploading...'}</span>
              <span className="font-mono">{pct}%{file ? ` (${formatBytes(Math.round(file.size * progress))} of ${formatBytes(file.size)})` : ''}</span>
            </div>
            <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(142,142,147,0.2)', overflow: 'hidden' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #D4AF37, #AA7C11)', transition: 'width 0.2s ease' }} />
            </div>
            {note && <p style={{ fontSize: '0.74rem', color: 'var(--color-muted-gray)', marginTop: '0.5rem' }}>{note}</p>}
            <button key="cancel" type="button" className="btn-outline-gold" style={{ marginTop: '0.9rem', padding: '0.6rem 1.1rem', fontSize: '0.8rem' }} onClick={() => abortRef.current?.abort()}>Cancel</button>
          </div>
        ) : (
          <button key="submit" type="submit" className="btn-gold" style={{ justifyContent: 'center', padding: '0.95rem', fontSize: '0.9rem' }}>
            <Upload size={16} /><span>Upload and publish</span>
          </button>
        )}
      </form>

      {/* Releases */}
      <h3 className="font-display" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-neutral-light)', marginBottom: '0.75rem' }}>Releases</h3>
      {loadError && <p className="pf-error-text" role="alert"><AlertCircle size={13} />{loadError}</p>}
      {releases === null ? (
        <p style={{ color: 'var(--color-muted-gray)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Loader2 size={15} style={{ animation: 'spin 0.9s linear infinite' }} /> Loading...</p>
      ) : releases.length === 0 ? (
        <p style={{ color: 'var(--color-muted-gray)', fontSize: '0.9rem' }}>No release uploaded yet. The download section stays hidden on the website until you upload one.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {releases.map((r) => (
            <div key={r.id} data-testid="apk-release" style={{ padding: '0.9rem 1.1rem', background: 'var(--color-secondary-dark)', border: `1px solid ${r.isCurrent ? 'rgba(212,175,55,0.5)' : 'rgba(142,142,147,0.15)'}`, borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-neutral-light)' }}>Version {r.version}</span>
                {r.isCurrent && <span className="font-mono" style={{ fontSize: '0.58rem', letterSpacing: '0.12em', background: 'var(--color-accent-gold)', color: '#0D0D0D', borderRadius: '4px', padding: '2px 6px', fontWeight: 700 }}>CURRENT</span>}
              </div>
              <p className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--color-muted-gray)', margin: '0.3rem 0', lineHeight: 1.6 }}>
                {formatBytes(r.size)} &middot; {formatDate(r.createdAt)} &middot; {r.downloads} download{r.downloads === 1 ? '' : 's'} &middot; sha256 {r.sha256.slice(0, 12)}...
              </p>
              {r.notes && <p style={{ fontSize: '0.8rem', color: 'var(--color-muted-gray)', whiteSpace: 'pre-line', marginBottom: '0.4rem' }}>{r.notes}</p>}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                {!r.isCurrent && <button type="button" className="btn-outline-gold" style={{ padding: '0.45rem 0.85rem', fontSize: '0.74rem' }} onClick={() => makeCurrent(r)}><CheckCircle2 size={13} /><span>Make current</span></button>}
                <button type="button" onClick={() => copy(r.sha256, `sha${r.id}`)} className="btn-outline-gold" style={{ padding: '0.45rem 0.85rem', fontSize: '0.74rem' }}>
                  {copied === `sha${r.id}` ? <Check size={13} /> : <Copy size={13} />}<span>Copy checksum</span>
                </button>
                <button type="button" onClick={() => remove(r)} style={{ padding: '0.45rem 0.85rem', fontSize: '0.74rem', background: 'none', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Trash2 size={13} /><span>Delete</span>
                </button>
              </div>
            </div>
          ))}
          <p style={{ fontSize: '0.74rem', color: 'var(--color-muted-gray)' }}>
            The {limits.keep} newest releases are kept; older ones are deleted automatically{current ? '' : ' (no release is current right now)'}.
          </p>
        </div>
      )}
    </div>
  );
}
