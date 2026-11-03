import { Truck, MessageCircle } from 'lucide-react';
import { DELIVERY } from '../config';

// Home page: two plain facts about ordering.
export default function ServiceStrip() {
  const items = [
    { Icon: Truck, title: DELIVERY.title, text: DELIVERY.note },
    { Icon: MessageCircle, title: 'Order on WhatsApp', text: 'Pick your items, send one message, and we confirm stock and payment with you.' },
  ];
  return (
    <section aria-label="How ordering works" style={{ borderTop: '1px solid rgba(170,124,17,0.12)', padding: '2.5rem 1.5rem' }}>
      <div className="container-max service-grid">
        {items.map(({ Icon, title, text }) => (
          <div key={title} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <span className="follow-icon"><Icon size={20} aria-hidden="true" /></span>
            <div>
              <p className="font-display" style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-neutral-light)', marginBottom: '0.2rem' }}>{title}</p>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.55, color: 'var(--color-muted-gray)' }}>{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
