import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Smartphone, Copy, Check, ChevronRight } from 'lucide-react';
import { APK_DOWNLOAD_URL, formatDate } from '../utils/apk';
import { formatBytes } from '../utils/image';

const STEPS = [
  'Tap Download APK. If your browser warns that this type of file can harm your device, choose Download anyway.',
  'Open the downloaded file from your notifications or your Downloads folder.',
  'If Android asks, allow your browser to install apps from this source, then go back.',
  'Tap Install, then Open.',
];

// `compact` (home page): details and the download button. Full (app page): install steps and the checksum too.
export default function AppDownloadCard({ release, compact = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(release.sha256); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  };

  return (
    <div style={{ background: 'var(--color-secondary-dark)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '14px', padding: '1.5rem', maxWidth: '560px', margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <span className="follow-icon"><Smartphone size={22} aria-hidden="true" /></span>
        <div style={{ minWidth: 0 }}>
          <p className="font-display" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-neutral-light)' }}>Carter The Town Wear for Android</p>
          <p className="font-mono" style={{ fontSize: '0.7rem', letterSpacing: '0.05em', color: 'var(--color-muted-gray)' }}>
            Version {release.version} &middot; {formatBytes(release.size)}{release.createdAt ? ` · ${formatDate(release.createdAt)}` : ''}
          </p>
        </div>
      </div>

      {release.notes && (
        <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--color-muted-gray)', marginBottom: '1.1rem', whiteSpace: 'pre-line' }}>
          <strong style={{ color: 'var(--color-neutral-light)', fontWeight: 600 }}>What is new: </strong>{release.notes}
        </p>
      )}

      <a href={APK_DOWNLOAD_URL} className="btn-gold" style={{ width: '100%', justifyContent: 'center', padding: '0.95rem', fontSize: '0.9rem', borderRadius: '6px', textDecoration: 'none' }}>
        <Download size={16} /><span>Download APK</span>
      </a>
      <p style={{ fontSize: '0.74rem', color: 'var(--color-muted-gray)', marginTop: '0.75rem', lineHeight: 1.5, textAlign: 'center' }}>
        Android phones only. To keep the site fast, each connection can download a few times per hour.
      </p>

      {compact ? (
        <Link to="/app" className="footer-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.9rem', fontSize: '0.74rem' }}>
          Install help <ChevronRight size={13} />
        </Link>
      ) : (
        <>
          <h3 className="font-display" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-neutral-light)', margin: '1.75rem 0 0.75rem' }}>How to install</h3>
          <ol style={{ paddingLeft: '1.4rem', listStyle: 'decimal outside', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--color-muted-gray)', fontSize: '0.88rem', lineHeight: 1.55 }}>
            {STEPS.map((s) => <li key={s} style={{ display: 'list-item', paddingLeft: '0.2rem' }}>{s}</li>)}
          </ol>
          <div style={{ marginTop: '1.5rem', paddingTop: '1.1rem', borderTop: '1px solid rgba(142,142,147,0.15)' }}>
            <p className="font-mono" style={{ fontSize: '0.64rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted-gold)', marginBottom: '0.4rem' }}>SHA-256 checksum</p>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <code style={{ flex: 1, fontSize: '0.68rem', wordBreak: 'break-all', color: 'var(--color-muted-gray)', lineHeight: 1.5 }}>{release.sha256}</code>
              <button type="button" onClick={copy} aria-label="Copy checksum" className="footer-social" style={{ width: '32px', height: '32px', background: 'none', cursor: 'pointer', flexShrink: 0 }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
