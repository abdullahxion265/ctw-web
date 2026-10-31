// Cart logic (pure functions, no React). Orders are placed over WhatsApp, so the cart only
// has to collect items, quantities and a note, and turn them into one message.
import { getPrice, formatMoney } from './currency';

export const MAX_QTY = 20;
export const MAX_LINES = 25;
export const MAX_NOTE = 300;

const clampQty = (n) => Math.min(MAX_QTY, Math.max(1, Math.floor(Number(n) || 1)));

// Only what the cart needs. Prices are refreshed from the server when the cart opens.
export function snapshot(product) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand || null,
    category: product.category,
    image_url: product.image_url || null,
    price: product.price ?? null,
    price_mwk: product.price_mwk ?? null,
    price_zar: product.price_zar ?? null,
  };
}

export function addItem(items, product, qty = 1) {
  const i = items.findIndex((l) => l.id === product.id);
  if (i >= 0) {
    return items.map((l, idx) => (idx === i ? { ...l, qty: clampQty(l.qty + qty) } : l));
  }
  if (items.length >= MAX_LINES) return items;
  return [...items, { ...snapshot(product), qty: clampQty(qty) }];
}

export function removeItem(items, id) {
  return items.filter((l) => l.id !== id);
}

export function setQty(items, id, qty) {
  if (qty < 1) return removeItem(items, id);
  return items.map((l) => (l.id === id ? { ...l, qty: clampQty(qty) } : l));
}

export const countItems = (items) => items.reduce((n, l) => n + l.qty, 0);

export function lineTotal(line, code) {
  const unit = getPrice(line, code);
  return unit === null ? null : unit * line.qty;
}

// total covers priced lines only; unpriced counts lines with no price in this currency.
export function cartTotal(items, code) {
  let total = 0;
  let unpriced = 0;
  for (const l of items) {
    const t = lineTotal(l, code);
    if (t === null) unpriced += 1;
    else total += t;
  }
  return { total, unpriced };
}

// Merge fresh product data (from the server) into the cart: update prices and names,
// keep quantities, drop products that no longer exist.
export function refreshItems(items, freshProducts) {
  const byId = new Map(freshProducts.map((p) => [p.id, p]));
  const kept = [];
  const removed = [];
  for (const l of items) {
    const p = byId.get(l.id);
    if (p) kept.push({ ...snapshot(p), qty: l.qty });
    else removed.push(l);
  }
  return { items: kept, removed };
}

export function buildCartMessage(items, code, note, shopName) {
  const lines = items.map((l, i) => {
    const unit = getPrice(l, code);
    const detail = unit === null
      ? `${l.qty} x Price on request`
      : `${l.qty} x ${formatMoney(unit, code)} = ${formatMoney(unit * l.qty, code)}`;
    return `${i + 1}. *${l.name}*${l.brand ? ` (${l.brand})` : ''}\n   ${detail}`;
  });
  const { total, unpriced } = cartTotal(items, code);
  const out = [`Hi ${shopName}! I'd like to order:`, '', ...lines, ''];
  out.push(`Total (${code}): ${formatMoney(total, code)}${unpriced ? ' + items on request' : ''}`);
  const trimmed = (note || '').trim().slice(0, MAX_NOTE);
  if (trimmed) out.push('', `Notes: ${trimmed}`);
  out.push('', 'Please confirm availability and how to pay.');
  return out.join('\n');
}

export function whatsappUrl(number, message) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
