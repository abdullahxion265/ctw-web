import { useLatestRelease } from '../utils/apk';
import AppDownloadCard from './AppDownloadCard';

// Home page section. Shows nothing until an APK has been uploaded.
export default function GetTheApp() {
  const data = useLatestRelease();
  if (!data || !data.available) return null;
  return (
    <section id="app" className="section-pad" style={{ borderTop: '1px solid rgba(170,124,17,0.12)' }}>
      <div className="container-max">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="font-mono" style={{ fontSize: '0.65rem', letterSpacing: '0.22em', color: 'var(--color-muted-gold)', textTransform: 'uppercase' }}>Mobile app</span>
          <h2 className="font-display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 700, color: 'var(--color-neutral-light)', margin: '0.4rem 0 0' }}>Get the App</h2>
        </div>
        <AppDownloadCard release={data} compact />
      </div>
    </section>
  );
}
