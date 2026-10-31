import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { API_BASE } from '../config';
import { addItem, removeItem, setQty, countItems, refreshItems, snapshot, MAX_LINES, MAX_QTY, MAX_NOTE } from '../utils/cart';

const STORAGE_KEY = 'cttw_cart_v1';
const CartContext = createContext(null);

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const items = (Array.isArray(raw.items) ? raw.items : [])
      .filter((l) => l && Number.isInteger(l.id) && typeof l.name === 'string' && Number.isFinite(l.qty))
      .slice(0, MAX_LINES)
      .map((l) => ({ ...snapshot(l), qty: Math.min(MAX_QTY, Math.max(1, Math.floor(l.qty))) }));
    return { items, note: typeof raw.note === 'string' ? raw.note.slice(0, MAX_NOTE) : '' };
  } catch {
    return { items: [], note: '' };
  }
}

export function CartProvider({ children }) {
  const [state, setState] = useState(load);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const { items, note } = state;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, [state]);

  // Pull current prices and drop products that were deleted. Silent on network errors.
  const refresh = useCallback(async () => {
    const current = itemsRef.current;
    if (!current.length) return;
    try {
      const ids = current.map((l) => l.id).join(',');
      const res = await fetch(`${API_BASE}/products?ids=${ids}&limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data.products)) return;
      const { removed } = refreshItems(itemsRef.current, data.products);
      setState((s) => ({ ...s, items: refreshItems(s.items, data.products).items }));
      if (removed.length) setNotice(`${removed.map((r) => r.name).join(', ')} is no longer available and was removed.`);
    } catch { /* keep the cart as is */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openCart = useCallback(() => { setOpen(true); refresh(); }, [refresh]);
  // The notice stays until the drawer has been shown and closed once.
  const closeCart = useCallback(() => { setOpen(false); setNotice(''); }, []);

  const value = useMemo(() => ({
    items,
    note,
    count: countItems(items),
    open,
    notice,
    openCart,
    closeCart,
    add: (product, qty = 1) => setState((s) => ({ ...s, items: addItem(s.items, product, qty) })),
    setQuantity: (id, qty) => setState((s) => ({ ...s, items: setQty(s.items, id, qty) })),
    remove: (id) => setState((s) => ({ ...s, items: removeItem(s.items, id) })),
    setNote: (text) => setState((s) => ({ ...s, note: text.slice(0, MAX_NOTE) })),
    clear: () => setState({ items: [], note: '' }),
  }), [items, note, open, notice, openCart, closeCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
