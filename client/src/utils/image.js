// Prepare a photo for upload: fix size, format and weight in the browser before it leaves the phone.
// Phone photos are often 4 to 15 MB. Resizing to 1600px and re-encoding as JPEG brings them to a few
// hundred KB, which uploads fast on mobile data and stays under any proxy size limit.
const MAX_SIDE = 1600;
const TARGET_BYTES = 650 * 1024;
const SKIP_BELOW_BYTES = 500 * 1024;
const RAW_LIMIT_BYTES = 40 * 1024 * 1024;
const FINAL_LIMIT_BYTES = 7.5 * 1024 * 1024;
const KEEP_AS_IS = ['image/jpeg', 'image/png', 'image/webp'];

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

// Returns { file, width, height, originalSize, size, resized } or throws an Error with a friendly message.
export async function prepareImage(file) {
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

    // Already light and in an accepted format: send it untouched
    if (KEEP_AS_IS.includes(file.type) && file.size <= SKIP_BELOW_BYTES && longest <= MAX_SIDE) {
      return { file, width: w, height: h, originalSize: file.size, size: file.size, resized: false };
    }

    let scale = Math.min(1, MAX_SIDE / longest);
    let quality = 0.86;
    let blob = null;
    let cw = w;
    let ch = h;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      cw = Math.max(1, Math.round(w * scale));
      ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';           // flatten transparency so PNG cut-outs do not turn black
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);    // the browser applies the photo's rotation here
      blob = await toBlob(canvas, 'image/jpeg', quality);
      if (blob && blob.size <= TARGET_BYTES) break;
      if (quality > 0.66) quality -= 0.1; else scale *= 0.85;
    }

    if (!blob) throw new Error('This photo could not be prepared. Try another one.');
    if (blob.size > FINAL_LIMIT_BYTES) throw new Error('This photo is still too large after shrinking. Try another photo.');

    const base = (file.name || 'photo').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'photo';
    const out = new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
    return { file: out, width: cw, height: ch, originalSize: file.size, size: out.size, resized: true };
  } finally {
    URL.revokeObjectURL(url);
  }
}
