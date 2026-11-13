import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw, PackageSearch, ChevronRight } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import SkeletonCard from '../components/SkeletonCard';
import { API_BASE, APP_TAGLINE } from '../config';
import { LogoFull } from '../components/Logo';
import ServiceStrip from '../components/ServiceStrip';
import FollowUs from '../components/FollowUs';
import GetTheApp from '../components/GetTheApp';

export default function Home() {
  const [picks, setPicks] = useState([]);
  const [picksLoading, setPicksLoading] = useState(true);

  const fetchPicks = useCallback(async () => {
    setPicksLoading(true);
    try {
      const res = await fetch(`${API_BASE}/products/picks`);
      const data = await res.json();
      setPicks(Array.isArray(data) ? data : []);
    } catch {
      setPicks([]);
    } finally {
      setPicksLoading(false);
    }
  }, []);

  useEffect(() => { fetchPicks(); }, [fetchPicks]);

  return (
    <main style={{ background: 'var(--color-primary-dark)', minHeight: '100vh' }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div className="hero-bg" />
        <div className="hero-lines" />

        <div className="container-max" style={{ position: 'relative', zIndex: 1, padding: '9rem 1.5rem 6rem', textAlign: 'center' }}>
          {/* Eyebrow */}
          <div className="animate-fade-up delay-100" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '2rem' }}>
            <div style={{ width: '32px', height: '1px', background: 'var(--color-muted-gold)' }} />
            <span className="font-mono" style={{ fontSize: '0.65rem', letterSpacing: '0.24em', color: 'var(--color-muted-gold)', textTransform: 'uppercase' }}>
              New Season Collection
            </span>
            <div style={{ width: '32px', height: '1px', background: 'var(--color-muted-gold)' }} />
          </div>

          {/* Logo */}
          <div className="animate-fade-up delay-200">
            <h1 style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
              CarterTheTownWear
            </h1>
            <LogoFull width="clamp(230px, 46vw, 470px)" alt="" style={{ margin: '0 auto' }} />
          </div>

          {/* Tagline */}
          <p className="font-display animate-fade-up delay-300" style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.4rem)', fontWeight: 400, fontStyle: 'italic', color: 'var(--color-muted-gray)', margin: '1.5rem auto 2.5rem', maxWidth: '500px' }}>
            {APP_TAGLINE}
          </p>

          {/* CTAs */}
          <div className="animate-fade-up delay-400" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/browse" className="btn-gold" style={{ fontSize: '0.85rem', padding: '0.9rem 2.2rem', textDecoration: 'none' }}>
              <span>Browse Collection</span>
              <ArrowRight size={15} />
            </Link>
            <a href="#picks" className="btn-outline-gold" style={{ fontSize: '0.85rem', padding: '0.9rem 2rem' }}>
              Our Picks Today
            </a>
          </div>

          {/* Scroll cue */}
          <div className="animate-fade-in delay-800" style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: '1px', height: '44px', background: 'linear-gradient(to bottom, transparent, var(--color-muted-gold))' }} />
            <span className="font-mono" style={{ fontSize: '0.58rem', letterSpacing: '0.2em', color: 'var(--color-muted-gray)', textTransform: 'uppercase' }}>Scroll</span>
          </div>
        </div>
      </section>

      {/* ── OUR PICKS TODAY ──────────────────────────────────── */}
      <section id="picks" className="section-pad" style={{ borderTop: '1px solid rgba(170,124,17,0.12)' }}>
        <div className="container-max">
          {/* Header */}
          <div style={{ marginBottom: '3rem' }}>
            <span className="font-mono" style={{ fontSize: '0.65rem', letterSpacing: '0.22em', color: 'var(--color-muted-gold)', textTransform: 'uppercase' }}>
              Curated Daily
            </span>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginTop: '0.4rem' }}>
              <h2 className="font-display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 700, color: 'var(--color-neutral-light)' }}>
                Our Picks Today
              </h2>
              <button onClick={fetchPicks} className="btn-outline-gold" style={{ fontSize: '0.76rem', padding: '0.5rem 1rem' }}>
                <RefreshCw size={13} /> <span>Refresh</span>
              </button>
            </div>
            <div className="gold-divider" style={{ width: '72px', marginTop: '0.85rem' }} />
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,280px),1fr))', gap: '1.5rem' }}>
            {picksLoading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} featured />)
              : picks.length === 0
              ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--color-muted-gray)' }}>
                  <PackageSearch size={38} style={{ margin: '0 auto 1rem', opacity: 0.35 }} />
                  <p style={{ fontSize: '0.9rem' }}>No products yet. Add some via Admin.</p>
                </div>
              )
              : picks.map(p => <ProductCard key={p.id} product={p} featured />)
            }
          </div>

          {/* Browse more CTA */}
          {!picksLoading && picks.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: '3rem' }}>
              <Link to="/browse" className="btn-outline-gold" style={{ fontSize: '0.85rem', padding: '0.75rem 2rem', textDecoration: 'none', display: 'inline-flex' }}>
                <span>View Full Collection</span>
                <ChevronRight size={15} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── ORDERING FACTS (delivery) ────────────────────────── */}
      <ServiceStrip />

      {/* ── GET THE APP (hidden until an APK is uploaded) ──── */}
      <GetTheApp />

      {/* ── FOLLOW US ────────────────────────────────────────── */}
      <FollowUs />
    </main>
  );
}
