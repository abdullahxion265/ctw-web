import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { DEFAULT_CURRENCY } from '../config';
import { isCurrency, formatProductPrice } from '../utils/currency';

const STORAGE_KEY = 'cttw_currency';
const CurrencyContext = createContext(null);

function readInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isCurrency(saved)) return saved;
  } catch { /* storage unavailable, fall through */ }
  return isCurrency(DEFAULT_CURRENCY) ? DEFAULT_CURRENCY : 'ZAR';
}

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(readInitial);

  const setCurrency = useCallback((code) => {
    if (!isCurrency(code)) return;
    setCurrencyState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({
    currency,
    setCurrency,
    priceOf: (product) => formatProductPrice(product, currency),
  }), [currency, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used inside CurrencyProvider');
  return ctx;
}
