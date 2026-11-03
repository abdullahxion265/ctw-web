// ── CarterTheTownWear — App Config ──────────────────────────
// Set VITE_WHATSAPP_NUMBER in client/.env.production before building.
// Format: international without + or spaces, e.g. "27821234567" (South Africa)
export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '27000000000';

// Currency shown before a visitor picks one: 'ZAR' (Rand) or 'MWK' (Kwacha).
// Override at build time with VITE_DEFAULT_CURRENCY in client/.env.production.
export const DEFAULT_CURRENCY = import.meta.env.VITE_DEFAULT_CURRENCY || 'ZAR';

// Social accounts shown in the Follow Us section and the footer. Change a link here and rebuild.
export const SOCIAL_LINKS = [
  { id: 'instagram', label: 'Instagram', sub: '@carter_the_town_wear_', url: 'https://www.instagram.com/carter_the_town_wear_/' },
  { id: 'tiktok',    label: 'TikTok',    sub: 'Watch our videos',       url: 'https://vt.tiktok.com/ZSgK4jeyJ/' },
  { id: 'facebook',  label: 'Facebook',  sub: 'Follow on Facebook',     url: 'https://www.facebook.com/100087507815896/posts/1076516918608559/' },
  { id: 'threads',   label: 'Threads',   sub: '@carter_the_town_wear_', url: 'https://www.threads.com/@carter_the_town_wear_' },
];

// Shown near ordering (product popup, cart, home page, footer). No fees or areas are promised here.
export const DELIVERY = {
  title: 'Delivery available',
  note: 'Tell us your area when you order and we will arrange delivery.',
};

export const APP_NAME = 'CarterTheTownWear';
export const APP_TAGLINE = 'Dressed for the town.';

export const API_BASE = '/api';

export const CATEGORIES = [
  { id: 'all',     label: 'All' },
  { id: 'men',     label: 'Men' },
  { id: 'women',   label: 'Women' },
  { id: 'hoodies', label: 'Hoodies' },
  { id: 'caps',    label: 'Caps' },
  { id: 'shoes',   label: 'Shoes' },
];

// Suggested in the admin Brand box. The admin can type any other brand.
export const DEFAULT_BRAND = 'CTW';

export const PRODUCTS_PER_PAGE = 12;
