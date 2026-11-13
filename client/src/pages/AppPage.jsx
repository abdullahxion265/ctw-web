import { Link } from 'react-router-dom';
import { useLatestRelease } from '../utils/apk';
import AppDownloadCard from '../components/AppDownloadCard';

export default function AppPage() {
  const data = useLatestRelease();
  return (
    <main style={{ minHeight: '70vh', padding: '8rem 1.25rem 4rem' }}>
      <div className="container-max">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span className="font-mono" style={{ fontSize: '0.65rem', letterSpacing: '0.22em', color: 'var(--color-muted-gold)', textTransform: 'uppercase' }}>Mobile app</span>
          <h1 className="font-display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 700, color: 'var(--color-neutral-light)', margin: '0.4rem 0 0' }}>Android App</h1>
        </div>
        {!data ? null : data.available ? <AppDownloadCard release={data} /> : (
          <p style={{ textAlign: 'center', color: 'var(--color-muted-gray)' }}>
            The app is not available yet. <Link to="/" className="footer-link" style={{ marginLeft: '0.4rem' }}>Back to the shop</Link>
          </p>
        )}
      </div>
    </main>
  );
}
