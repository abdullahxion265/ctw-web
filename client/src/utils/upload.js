import { API_BASE } from '../config';
import { messageForStatus } from './http';

// Create (or, with `id`, update) a product with a progress callback. fetch() cannot report upload progress, XHR can.
// `signal` (AbortSignal) cancels the request; the promise then rejects with name === 'AbortError'.
// `images` are the NEW photo files in order. For an update, `imageOrder` lists the final photos: existing
// photo URLs and "new:0", "new:1" (the files above, in order). Anything not listed is removed.
export function uploadProduct({ token, id, fields, images = [], imageOrder, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    images.forEach((file) => fd.append('images', file, file.name));
    if (id && imageOrder !== undefined) fd.append('image_order', JSON.stringify(imageOrder));

    const xhr = new XMLHttpRequest();
    xhr.open(id ? 'PUT' : 'POST', id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 120000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data);
      else reject(new Error((data && typeof data.error === 'string' && data.error) || messageForStatus(xhr.status)));
    };
    xhr.onerror = () => reject(new Error('Could not reach the server. Check your internet connection and try again.'));
    xhr.ontimeout = () => reject(new Error('The upload took too long. Check your connection and try again.'));
    xhr.onabort = () => { const e = new Error('Upload cancelled'); e.name = 'AbortError'; reject(e); };

    if (signal) {
      if (signal.aborted) { xhr.abort(); return; }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(fd);
  });
}
