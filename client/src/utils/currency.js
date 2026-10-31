// Currency helpers. Products carry two prices: price_zar (Rand) and price_mwk (Kwacha).
export const CURRENCIES = {
  ZAR: { code: 'ZAR', symbol: 'R',  name: 'Rand',   field: 'price_zar' },
  MWK: { code: 'MWK', symbol: 'MK', name: 'Kwacha', field: 'price_mwk' },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES);

export function isCurrency(code) {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code);
}

// Numeric price for a currency, or null when the product has none in that currency.
export function getPrice(product, code) {
  if (!product) return null;
  let raw = product[CURRENCIES[code].field];
  // Older rows (before the dual-currency migration) only have the legacy Kwacha `price`
  if ((raw === null || raw === undefined) && code === 'MWK') raw = product.price;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatMoney(amount, code) {
  const { symbol } = CURRENCIES[code];
  const text = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${text}`;
}

// Display string for a product in the chosen currency.
export function formatProductPrice(product, code) {
  const amount = getPrice(product, code);
  return amount === null ? 'Price on request' : formatMoney(amount, code);
}
