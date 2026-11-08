// Prepare a photo for upload: fix size, format and weight in the browser before it leaves the phone.
// Phone photos are often 4 to 15 MB. Resizing and re-encoding as JPEG brings them to a few hundred KB,
// which uploads quickly on mobile data and stays under proxy size limits. The target size is a parameter:
// uploadBudget.js lowers it when several photos share one request, or when the server answers "too large".
export const DEFAULT_TARGET_BYTES = 650 * 1024;
const RAW_LIMIT_BYTES = 40 * 1024 * 1024;
const FINAL_LIMIT_BYTES = 7.5 * 1024 * 1024;
const KEEP_AS_IS = ['image/jpeg', 'image/png', 'image/webp'];
const QUALITIES = [0.86, 0.78, 0.7, 0.62, 0.55];
const MIN_SIDE = 560;

// Smaller targets also get smaller pictures: product photos stay sharp on a phone at these sizes.
export function maxSideFor(targetBytes) {
  if (targetBytes >= 450 * 1024) return 1600;
  if (targetBytes >= 250 * 1024) return 1280;
  if (targetBytes >= 140 * 1024) return 1024;
  return 800;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('open')); };
    img.src = url;
  });
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

export function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

// Returns { file, source, width, height, originalSize, size, resized } or throws an Error with a friendly message.
// `force` always re-encodes (used when a photo has to be squeezed further to fit an upload budget).
export async function prepareImage(file, { targetBytes = DEFAULT_TARGET_BYTES, force = false } = {}) {
  const looksLikeImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
  if (!looksLikeImage) throw new Error('That file is not a photo. Choose a JPG, PNG or WebP image.');
  if (file.size > RAW_LIMIT_BYTES) throw new Error('That file is too big to process. Choose a smaller photo.');

  let loaded;
  try {
    loaded = await loadImage(file);
  } catch {
    throw new Error('This photo could not be opened. Try another one, or take a new photo.');
  }
  const { img, url } = loaded;

  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const longest = Math.max(w, h);
    const maxSide = maxSideFor(targetBytes);
    const acceptedType = KEEP_AS_IS.includes(file.type);

    // Already light and in an accepted format: send it untouched
    if (!force && acceptedType && file.size <= targetBytes * 0.75 && longest <= maxSide) {
      return { file, source: file, width: w, height: h, originalSize: file.size, size: file.size, resized: false };
    }

    let scale = Math.min(1, maxSide / longest);
    let qi = 0;
    let blob = null;
    let cw = w;
    let ch = h;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      cw = Math.max(1, Math.round(w * scale));
      ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';           // flatten transparency so PNG cut-outs do not turn black
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);    // the browser applies the photo's rotation here
      blob = await toBlob(canvas, 'image/jpeg', QUALITIES[qi]);
      if (blob && blob.size <= targetBytes) break;
      if (qi < QUALITIES.length - 1) qi += 1;       // first lower the quality
      else if (Math.max(cw, ch) > MIN_SIDE) scale *= 0.85;   // then the dimensions
      else break;                                   // as small as it gets
    }

    if (!blob) throw new Error('This photo could not be prepared. Try another one.');
    if (blob.size > FINAL_LIMIT_BYTES) throw new Error('This photo is still too large after shrinking. Try another photo.');
    // Re-encoding made it bigger and the original was fine: keep the original
    if (!force && acceptedType && longest <= maxSide && blob.size >= file.size) {
      return { file, source: file, width: w, height: h, originalSize: file.size, size: file.size, resized: false };
    }

    const base = (file.name || 'photo').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'photo';
    const out = new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    return { file: out, source: file, width: cw, height: ch, originalSize: file.size, size: out.size, resized: true };
  } finally {
    URL.revokeObjectURL(url);
  }
}
