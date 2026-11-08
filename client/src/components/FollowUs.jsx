import { ArrowUpRight } from 'lucide-react';
import { SOCIAL_LINKS } from '../config';
import SocialIcon from './SocialIcon';

// Home page section: big link cards for every social account.
export default function FollowUs() {
  return (
    <section id="follow" className="section-pad" style={{ borderTop: '1px solid rgba(170,124,17,0.12)' }}>
      <div className="container-max">
        <div style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto 2.5rem' }}>
          <span className="font-mono" style={{ fontSize: '0.65rem', letterSpacing: '0.22em', color: 'var(--color-muted-gold)', textTransform: 'uppercase' }}>
            Stay in the loop
          </span>
          <h2 className="font-display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 700, color: 'var(--color-neutral-light)', margin: '0.4rem 0 0' }}>
            Follow Us
          </h2>
        </div>

        <div className="follow-grid">
          {SOCIAL_LINKS.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="follow-card" aria-label={`${s.sub}`}>
              <span className="follow-icon"><SocialIcon id={s.id} size={22} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="font-display" style={{ display: 'block', fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-neutral-light)' }}>{s.label}</span>
                <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--color-muted-gray)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sub}</span>
              </span>
              <ArrowUpRight size={16} style={{ color: 'var(--color-muted-gold)', flexShrink: 0 }} aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
