import { Truck } from 'lucide-react';
import { DELIVERY } from '../config';

// One-line "delivery available" reminder used next to the order buttons.
export default function DeliveryNote({ style }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.7rem 0.85rem',
        background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.22)', borderRadius: '8px', ...style,
      }}
    >
      <Truck size={17} style={{ color: 'var(--color-accent-gold)', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
      <p style={{ fontSize: '0.78rem', lineHeight: 1.45, color: 'var(--color-muted-gray)' }}>
        <strong style={{ color: 'var(--color-neutral-light)', fontWeight: 600 }}>{DELIVERY.title}.</strong> {DELIVERY.note}
      </p>
    </div>
  );
}
