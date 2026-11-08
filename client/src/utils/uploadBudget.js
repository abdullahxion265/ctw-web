import { prepareImage, DEFAULT_TARGET_BYTES } from './image';

// Why this exists: the supplier's front server may reject large requests ("413 too large"), and one
// product can send up to 4 photos in a single request. So every upload gets a total size budget:
//   - the budget is shared by the new photos (4 photos get a smaller share each than 1 photo),
//   - if the server still answers 413, the budget is halved and the upload retried automatically,
//   - the lower budget is remembered for a week, so the next upload does not fail first.
export const DEFAULT_TOTAL_BYTES = 900 * 1024;   // fits under the common 1 MB proxy default
export const MIN_TOTAL_BYTES = 240 * 1024;
const OVERHEAD_BYTES = 60 * 1024;                // form fields and multipart framing
const MIN_PER_PHOTO = 70 * 1024;
const KEY = 'cttw_upload_budget_v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getUploadBudget() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Number.isFinite(saved.bytes) && Date.now() - saved.at < TTL_MS) {
      return Math.min(DEFAULT_TOTAL_BYTES, Math.max(MIN_TOTAL_BYTES, saved.bytes));
    }
  } catch { /* storage unavailable or corrupt: use the default */ }
  return DEFAULT_TOTAL_BYTES;
}

export function saveUploadBudget(bytes) {
  try { localStorage.setItem(KEY, JSON.stringify({ bytes, at: Date.now() })); } catch { /* ignore */ }
}

// Share of the budget each photo may use when `count` new photos go in one request.
export function targetPerPhoto(count, budget) {
  const share = Math.floor((budget - OVERHEAD_BYTES) / Math.max(1, count));
  return Math.min(DEFAULT_TARGET_BYTES, Math.max(MIN_PER_PHOTO, share));
}

// Re-encode (from the original file) any new photo that is bigger than its share. `items` are the new photo
// entries ({ key, file, source, size, ... }); returns the same entries, updated. Calls onStep(done, total).
export async function fitPhotos(items, budget, { signal, onStep } = {}) {
  const target = targetPerPhoto(items.length, budget);
  const out = [];
  for (let i = 0; i < items.length; i += 1) {
    if (signal?.aborted) { const e = new Error('Cancelled'); e.name = 'AbortError'; throw e; }
    onStep?.(i, items.length);
    const item = items[i];
    if (item.size <= target) {
      out.push(item);
    } else {
      const r = await prepareImage(item.source || item.file, { targetBytes: target, force: true });
      out.push({ ...item, file: r.file, size: r.size, width: r.width, height: r.height, resized: true });
    }
  }
  onStep?.(items.length, items.length);
  return out;
}
