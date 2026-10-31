import { useCurrency } from '../context/CurrencyContext';
import { CURRENCIES, CURRENCY_CODES } from '../utils/currency';

// Two-option toggle: Rand / Kwacha. `compact` is the short form used in the mobile bar.
export default function CurrencySwitcher({ compact = false }) {
  const { currency, setCurrency } = useCurrency();

  return (
    <div role="group" aria-label="Choose currency" style={{ display: 'inline-flex', gap: '0.35rem' }}>
      {CURRENCY_CODES.map((code) => {
        const c = CURRENCIES[code];
        const active = currency === code;
        return (
          <button
            key={code}
            type="button"
            className={`filter-pill ${active ? 'active' : ''}`}
            aria-pressed={active}
            title={`Show prices in ${c.name}`}
            onClick={() => setCurrency(code)}
            style={compact ? { padding: '0.3rem 0.7rem', fontSize: '0.72rem' } : { padding: '0.35rem 0.9rem', fontSize: '0.78rem' }}
          >
            {compact ? c.symbol : `${c.symbol} ${c.code}`}
          </button>
        );
      })}
    </div>
  );
}
