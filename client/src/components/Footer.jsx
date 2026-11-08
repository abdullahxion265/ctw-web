import { Link, useLocation } from 'react-router-dom';
import { Truck, Mail } from 'lucide-react';
import { LogoFull } from './Logo';
import SocialIcon from './SocialIcon';
import { SOCIAL_LINKS, DELIVERY, CONTACT_EMAIL, APP_NAME } from '../config';

// Site-wide footer. Hidden on the admin pages.
export default function Footer() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) return null;

  return (
    <footer style={{ borderTop: '1px solid rgba(170,124,17,0.12)', padding: '3rem 1.5rem 2.5rem', textAlign: 'center' }}>
      <div className="container-max">
        <LogoFull width={170} style={{ margin: '0 auto 1.5rem' }} />

        <nav aria-label="Footer" style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <Link to="/" className="footer-link">Home</Link>
          <Link to="/browse" className="footer-link">Browse</Link>
        </nav>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
          {SOCIAL_LINKS.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="footer-social" aria-label={`${s.label} (opens in a new tab)`} title={s.label}>
              <SocialIcon id={s.id} size={18} />
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <p style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-muted-gray)' }}>
            <Truck size={15} style={{ color: 'var(--color-accent-gold)' }} aria-hidden="true" /> {DELIVERY.title}
          </p>
          <p style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-muted-gray)' }}>
            <Mail size={15} style={{ color: 'var(--color-accent-gold)' }} aria-hidden="true" /> {CONTACT_EMAIL}
          </p>
        </div>

        <p className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--color-muted-gray)', letterSpacing: '0.08em' }}>
          &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
