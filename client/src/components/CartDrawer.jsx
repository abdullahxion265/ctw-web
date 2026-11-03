import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Minus, Plus, Trash2, MessageCircle, ShoppingCart, Shirt } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { WHATSAPP_NUMBER, APP_NAME } from '../config';
import { CURRENCIES, formatMoney } from '../utils/currency';
import DeliveryNote from './DeliveryNote';
import { cartTotal, lineTotal, buildCartMessage, whatsappUrl, MAX_QTY, MAX_NOTE } from '../utils/cart';

const iconBtn = {
  width: '30px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--color-primary-dark)', border: '1px solid rgba(142,142,147,0.25)', borderRadius: '6px',
  color: 'var(--color-neutral-light)', cursor: 'pointer',
};

export default function CartDrawer() {
  const { items, note, open, notice, closeCart, setQuantity, remove, setNote, clear } = useCart();
  const { currency } = useCurrency();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeCart(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, closeCart]);

  if (!open) return null;

  const { total, unpriced } = cartTotal(items, currency);
  const orderUrl = whatsappUrl(WHATSAPP_NUMBER, buildCartMessage(items, currency, note, APP_NAME));

  return (
    <div onClick={closeCart} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }}>
      <aside
        role="dialog" aria-modal="true" aria-label="Shopping cart"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(440px, 100%)',
          background: 'var(--color-secondary-dark)', borderLeft: '1px solid rgba(212,175,55,0.2)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.25rem', borderBottom: '1px solid rgba(142,142,147,0.15)' }}>
          <h2 className="font-display" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-neutral-light)' }}>
            Your cart
          </h2>
          <button onClick={closeCart} aria-label="Close cart" style={{ ...iconBtn, border: 'none', background: 'none' }}><X size={18} /></button>
        </header>

        {notice && (
          <p style={{ margin: '0.75rem 1.25rem 0', padding: '0.6rem 0.8rem', fontSize: '0.78rem', color: 'var(--color-accent-gold)', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '6px' }}>
            {notice}
          </p>
        )}

        {items.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.9rem', padding: '2rem', textAlign: 'center' }}>
            <ShoppingCart size={34} style={{ color: 'var(--color-muted-gold)', opacity: 0.6 }} />
            <p style={{ color: 'var(--color-muted-gray)', fontSize: '0.9rem' }}>Your cart is empty.</p>
            <Link to="/browse" onClick={closeCart} className="btn-gold" style={{ padding: '0.7rem 1.4rem', fontSize: '0.8rem' }}>
              <span>Browse the collection</span>
            </Link>
          </div>
        ) : (
          <>
            <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: '0.5rem 1.25rem' }}>
              {items.map((l) => {
                const unitText = lineTotal({ ...l, qty: 1 }, currency);
                const lt = lineTotal(l, currency);
                return (
                  <li key={l.id} style={{ display: 'flex', gap: '0.85rem', padding: '0.95rem 0', borderBottom: '1px solid rgba(142,142,147,0.12)' }}>
                    <div style={{ width: '64px', height: '76px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', background: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {l.image_url
                        ? <img src={l.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Shirt size={22} style={{ color: 'var(--color-muted-gold)', opacity: 0.5 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-neutral-light)', lineHeight: 1.3 }}>{l.name}</span>
                        <button onClick={() => remove(l.id)} aria-label={`Remove ${l.name}`} style={{ background: 'none', border: 'none', color: 'var(--color-muted-gray)', cursor: 'pointer', padding: 0, height: '20px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {l.brand && (
                        <span className="brand-label" style={{ display: 'block', marginBottom: '0.15rem' }}>{l.brand}</span>
                      )}
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-gray)' }}>
                        {unitText === null ? 'Price on request' : `${formatMoney(unitText, currency)} each`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.55rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button style={iconBtn} aria-label="Decrease quantity" onClick={() => setQuantity(l.id, l.qty - 1)}><Minus size={13} /></button>
                          <span style={{ minWidth: '1.5rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{l.qty}</span>
                          <button style={{ ...iconBtn, opacity: l.qty >= MAX_QTY ? 0.4 : 1 }} aria-label="Increase quantity" disabled={l.qty >= MAX_QTY} onClick={() => setQuantity(l.id, l.qty + 1)}><Plus size={13} /></button>
                        </div>
                        <span className="price-display" style={{ fontSize: '0.9rem' }}>{lt === null ? '' : formatMoney(lt, currency)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <footer style={{ padding: '1rem 1.25rem 1.25rem', borderTop: '1px solid rgba(142,142,147,0.15)', background: 'var(--color-secondary-dark)' }}>
              <DeliveryNote style={{ marginBottom: '0.9rem' }} />
              <label htmlFor="cart-note" style={{ display: 'block', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted-gold)', marginBottom: '0.35rem' }}>
                Sizes, colours, delivery area or notes
              </label>
              <textarea
                id="cart-note" className="input-dark" rows={2} maxLength={MAX_NOTE} value={note}
                onChange={(e) => setNote(e.target.value)} placeholder="e.g. Hoodie: L, black. Deliver to: your area"
                style={{ resize: 'none', fontSize: '0.85rem', marginBottom: '0.9rem' }}
              />
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted-gray)' }}>
                  Total ({CURRENCIES[currency].name})
                </span>
                <span className="price-display" style={{ fontSize: '1.4rem' }}>{formatMoney(total, currency)}</span>
              </div>
              {unpriced > 0 && (
                <p style={{ fontSize: '0.72rem', color: 'var(--color-muted-gray)', marginBottom: '0.5rem' }}>
                  {unpriced} item{unpriced > 1 ? 's' : ''} priced on request in {CURRENCIES[currency].name}, not included above.
                </p>
              )}
              <a href={orderUrl} target="_blank" rel="noopener noreferrer" className="btn-gold"
                 style={{ width: '100%', justifyContent: 'center', padding: '0.95rem', fontSize: '0.875rem', borderRadius: '6px', textDecoration: 'none', marginTop: '0.5rem' }}>
                <MessageCircle size={16} />
                <span>Order via WhatsApp</span>
              </a>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-muted-gray)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                  We confirm stock and payment on WhatsApp
                </span>
                <button onClick={clear} style={{ background: 'none', border: 'none', color: 'var(--color-muted-gray)', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}>
                  Clear cart
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
