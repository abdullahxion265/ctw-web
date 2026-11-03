import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, ImagePlus, CheckCircle2, AlertCircle, Loader2, X, Shirt, PlusCircle, Package,
  ChevronLeft, ChevronRight, Plus,
} from 'lucide-react';
import { CATEGORIES, DEFAULT_BRAND } from '../config';
import { formatMoney } from '../utils/currency';
import { prepareImage, formatBytes } from '../utils/image';
import { uploadProduct } from '../utils/upload';
import { photosOf, MAX_PHOTOS } from '../utils/photos';

const CATEGORY_OPTIONS = CATEGORIES.filter((c) => c.id !== 'all');
const EMPTY = { name: '', brand: '', category: 'men', price_zar: '', price_mwk: '', description: '' };

const labelStyle = {
  display: 'block', fontSize: '0.68rem', letterSpacing: '0.14em', color: 'var(--color-muted-gold)',
  textTransform: 'uppercase', marginBottom: '0.45rem', fontFamily: 'var(--font-mono)',
};
const stepStyle = {
  display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem',
  fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-neutral-light)',
};
const stepNum = {
  width: '22px', height: '22px', borderRadius: '999px', border: '1px solid var(--color-accent-gold)',
  color: 'var(--color-accent-gold)', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center',
  justifyContent: 'center', fontFamily: 'var(--font-mono)',
};
const bigBtn = { flex: '1 1 150px', justifyContent: 'center', padding: '0.85rem 1rem', fontSize: '0.82rem' };
const tileBtn = {
  width: '22px', height: '22px', borderRadius: '999px', border: '1px solid rgba(245,245,247,0.25)', cursor: 'pointer',
  background: 'rgba(13,13,13,0.82)', color: 'var(--color-neutral-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
};

const toInput = (v) => (v === null || v === undefined || v === '' ? '' : String(Number(v)));
function fieldsFromProduct(p) {
  return {
    name: p.name || '', brand: p.brand || '', category: p.category || 'men',
    price_zar: toInput(p.price_zar), price_mwk: toInput(p.price_mwk ?? p.price), description: p.description || '',
  };
}
const existingPhotos = (p) => photosOf(p).map((path, i) => ({ key: `e${i}`, kind: 'existing', url: path, path }));
const photoSignature = (list) => list.map((p) => (p.kind === 'existing' ? p.path : `${p.name}:${p.size}`)).join('|');

const isTouch = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
let uid = 0;

// Add mode (default) creates a product. Pass `product` to edit an existing one: the form is prefilled and the
// photos can be reordered, removed or added. Saving calls onSaved instead of showing "Product added".
export default function ProductForm({ token, brands = [], onCreated, onViewInventory, product, onSaved, onCancel }) {
  const isEdit = !!product;
  const [fields, setFields] = useState(() => (product ? fieldsFromProduct(product) : EMPTY));
  const [photos, setPhotos] = useState(() => (product ? existingPhotos(product) : []));
  const initialRef = useRef({ fields, photos: photoSignature(photos) });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(0);                  // photos being prepared
  const [photoMsg, setPhotoMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState('editing');        // editing | uploading | done
  const [progress, setProgress] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [askNoPhoto, setAskNoPhoto] = useState(false);
  const [created, setCreated] = useState(null);         // { product, photoUrl, urls }

  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const abortRef = useRef(null);
  const urlsRef = useRef(new Set());                    // object URLs to free
  const rootRef = useRef(null);
  const touch = isTouch();

  useEffect(() => () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    abortRef.current?.abort();
  }, []);

  const setField = (name, value) => {
    setFields((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };
  const onChange = (e) => setField(e.target.name, e.target.value);

  // ── photos ───────────────────────────────────────────────
  const room = MAX_PHOTOS - photos.length - busy;

  const addFiles = useCallback(async (fileList, free) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setAskNoPhoto(false);
    setPhotoMsg('');
    const take = files.slice(0, Math.max(0, free));
    const skipped = files.length - take.length;
    const problems = [];
    setBusy((n) => n + take.length);
    for (const file of take) {
      try {
        const r = await prepareImage(file);
        const url = URL.createObjectURL(r.file);
        urlsRef.current.add(url);
        setPhotos((prev) => {
          if (prev.length >= MAX_PHOTOS) { URL.revokeObjectURL(url); urlsRef.current.delete(url); return prev; }
          uid += 1;
          return [...prev, { key: `n${uid}`, kind: 'new', url, file: r.file, name: file.name, size: r.size, originalSize: r.originalSize, resized: r.resized, width: r.width, height: r.height }];
        });
      } catch (err) {
        problems.push(`${file.name}: ${err.message}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (skipped > 0) problems.push(`Only ${MAX_PHOTOS} photos fit per product. ${skipped} extra ${skipped === 1 ? 'photo was' : 'photos were'} skipped.`);
    if (problems.length) setPhotoMsg(problems.join(' '));
  }, []);

  const onPick = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';           // lets the same file be chosen again
    addFiles(picked, room);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files, room);
  };
  const removeAt = (i) => {
    setPhotos((prev) => {
      const gone = prev[i];
      if (gone?.kind === 'new') { URL.revokeObjectURL(gone.url); urlsRef.current.delete(gone.url); }
      return prev.filter((_, idx) => idx !== i);
    });
    setPhotoMsg('');
  };
  const move = (i, dir) => {
    setPhotos((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const openGallery = () => galleryRef.current?.click();
  const openCamera = () => cameraRef.current?.click();

  // ── submit ───────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!fields.name.trim()) e.name = 'Enter the product name.';
    if (!(Number(fields.price_zar) > 0)) e.price_zar = 'Enter the Rand price.';
    if (!(Number(fields.price_mwk) > 0)) e.price_mwk = 'Enter the Kwacha price.';
    setErrors(e);
    const first = ['name', 'price_zar', 'price_mwk'].find((k) => e[k]);
    if (first) document.getElementById(first)?.focus();
    return !first;
  };

  const submit = async (ev, { withoutPhoto = false } = {}) => {
    ev?.preventDefault();
    if (phase === 'uploading' || busy > 0) return;
    setSubmitError('');
    if (!validate()) return;
    if (!isEdit && photos.length === 0 && !withoutPhoto) {
      setAskNoPhoto(true);
      return;
    }
    setAskNoPhoto(false);
    setPhase('uploading');
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    let newIndex = 0;
    const imageOrder = isEdit ? photos.map((p) => (p.kind === 'existing' ? p.path : `new:${newIndex++}`)) : undefined;
    try {
      const saved = await uploadProduct({
        token,
        id: product?.id,
        fields: {
          name: fields.name.trim(), brand: fields.brand.trim(), category: fields.category,
          price_zar: fields.price_zar, price_mwk: fields.price_mwk, description: fields.description.trim(),
        },
        images: photos.filter((p) => p.kind === 'new').map((p) => p.file),
        imageOrder,
        onProgress: setProgress,
        signal: controller.signal,
      });
      if (isEdit) {
        onSaved?.(saved);              // the parent closes the form
        return;
      }
      setCreated({ product: saved, photoUrl: photos[0]?.url || null, urls: photos.map((p) => p.url) });
      setPhotos([]);                   // the done card keeps its own copy of the preview URL
      setPhase('done');
      onCreated?.(saved);
    } catch (err) {
      setPhase('editing');
      if (err.name !== 'AbortError') setSubmitError(err.message);
    } finally {
      abortRef.current = null;
    }
  };

  const cancelUpload = () => abortRef.current?.abort();

  const dirty = JSON.stringify(fields) !== JSON.stringify(initialRef.current.fields) || photoSignature(photos) !== initialRef.current.photos;
  const cancelEdit = () => {
    if (dirty && !window.confirm('Discard your changes?')) return;
    onCancel?.();
  };

  const addAnother = () => {
    (created?.urls || []).forEach((u) => { URL.revokeObjectURL(u); urlsRef.current.delete(u); });
    setCreated(null);
    // keep brand and category: admins usually add several items in a row
    setFields((f) => ({ ...EMPTY, brand: f.brand, category: f.category }));
    setErrors({});
    setPhotoMsg('');
    setPhase('editing');
    setProgress(0);
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── done ─────────────────────────────────────────────────
  if (phase === 'done' && created) {
    const p = created.product;
    const n = (p.images || []).length;
    return (
      <div ref={rootRef} style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center', padding: '1rem 0' }}>
        <div style={{ width: '120px', height: '150px', margin: '0 auto 1.25rem', borderRadius: '10px', overflow: 'hidden', background: 'var(--color-secondary-dark)', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {created.photoUrl
            ? <img src={created.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Shirt size={30} style={{ color: 'var(--color-muted-gold)', opacity: 0.5 }} />}
        </div>
        <CheckCircle2 size={26} style={{ color: 'var(--color-accent-gold)', margin: '0 auto 0.6rem' }} />
        <h2 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-neutral-light)', marginBottom: '0.35rem' }}>
          Product added
        </h2>
        <p style={{ color: 'var(--color-muted-gray)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
          {p.name} is now live in the shop{n > 1 ? ` with ${n} photos.` : n === 1 ? '.' : ', with a placeholder instead of a photo.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" className="btn-gold" onClick={addAnother} style={{ ...bigBtn, flex: '0 1 220px' }}>
            <PlusCircle size={15} /><span>Add another product</span>
          </button>
          <button type="button" className="btn-outline-gold" onClick={onViewInventory} style={{ ...bigBtn, flex: '0 1 200px' }}>
            <Package size={15} /><span>View inventory</span>
          </button>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--color-muted-gray)', marginTop: '1rem' }}>
          Brand and category are kept for the next product.
        </p>
      </div>
    );
  }

  const uploading = phase === 'uploading';
  const retired = isEdit && !CATEGORY_OPTIONS.some((c) => c.id === product.category)
    ? [{ id: product.category, label: `${product.category.charAt(0).toUpperCase()}${product.category.slice(1)} (retired)` }]
    : [];
  const categoryOptions = [...CATEGORY_OPTIONS, ...retired];
  const categoryLabel = categoryOptions.find((c) => c.id === fields.category)?.label || '';
  const zar = Number(fields.price_zar) > 0 ? formatMoney(Number(fields.price_zar), 'ZAR') : null;
  const mwk = Number(fields.price_mwk) > 0 ? formatMoney(Number(fields.price_mwk), 'MWK') : null;
  const brandChips = [DEFAULT_BRAND, ...brands.filter((b) => b !== DEFAULT_BRAND)].slice(0, 8);
  const hasAny = photos.length > 0;
  const newPhotos = photos.filter((p) => p.kind === 'new');

  return (
    <div ref={rootRef}>
      <h2 className="font-display" style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--color-neutral-light)', marginBottom: '1.75rem' }}>
        {isEdit ? 'Edit product' : 'New Product'}
      </h2>

      <form noValidate onSubmit={submit} className="pf-grid">
        {/* ── 1. Photos ────────────────────────────────── */}
        <section
          className="pf-photo"
          aria-labelledby="pf-photo-h"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <h3 id="pf-photo-h" style={stepStyle}>
            <span style={stepNum}>1</span> Photos
            <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--color-muted-gray)', letterSpacing: '0.06em', fontWeight: 400 }}>
              optional, up to {MAX_PHOTOS}
            </span>
          </h3>

          <input id="photo-gallery" ref={galleryRef} type="file" accept="image/*" multiple onChange={onPick} style={{ display: 'none' }} />
          <input id="photo-camera" ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: 'none' }} />

          {!hasAny ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="Add photos"
              onClick={() => busy === 0 && openGallery()}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && busy === 0) { e.preventDefault(); openGallery(); } }}
              style={{
                border: `2px dashed ${dragOver ? 'var(--color-accent-gold)' : 'rgba(142,142,147,0.3)'}`,
                background: dragOver ? 'rgba(212,175,55,0.06)' : 'var(--color-secondary-dark)',
                borderRadius: '12px', padding: '2rem 1.25rem', textAlign: 'center',
                cursor: busy ? 'progress' : 'pointer', transition: 'all 0.2s ease', minHeight: '240px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {busy > 0 ? (
                <>
                  <Loader2 size={30} style={{ color: 'var(--color-accent-gold)', animation: 'spin 0.9s linear infinite' }} />
                  <p style={{ color: 'var(--color-neutral-light)', fontSize: '0.92rem' }}>Preparing photo...</p>
                </>
              ) : (
                <>
                  <ImagePlus size={34} style={{ color: 'var(--color-muted-gold)', opacity: 0.7 }} />
                  <p style={{ color: 'var(--color-neutral-light)', fontSize: '1rem', fontWeight: 600 }}>Add photos</p>
                  <p style={{ color: 'var(--color-muted-gray)', fontSize: '0.78rem', maxWidth: '270px', lineHeight: 1.5 }}>
                    Up to {MAX_PHOTOS} photos. The first one is the main photo in the shop. Large photos are shrunk automatically.
                  </p>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: '0.75rem' }}>
                    {touch && (
                      <button type="button" className="btn-gold" style={bigBtn} onClick={(e) => { e.stopPropagation(); openCamera(); }}>
                        <Camera size={16} /><span>Take photo</span>
                      </button>
                    )}
                    <button type="button" className={touch ? 'btn-outline-gold' : 'btn-gold'} style={bigBtn} onClick={(e) => { e.stopPropagation(); openGallery(); }}>
                      <ImagePlus size={16} /><span>{touch ? 'From gallery' : 'Choose photos'}</span>
                    </button>
                  </div>
                  {!touch && <p className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--color-muted-gray)', letterSpacing: '0.08em', marginTop: '0.5rem' }}>or drop images here</p>}
                </>
              )}
            </div>
          ) : (
            <div>
              {/* Main photo, framed and captioned like the shop card */}
              <div style={{ position: 'relative', aspectRatio: '4 / 5', width: 'min(100%, 300px)', margin: '0 auto', borderRadius: '12px', overflow: 'hidden', background: '#000', border: '1px solid rgba(212,175,55,0.3)' }}>
                <img src={photos[0].url} alt="Selected product" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', padding: '0.22rem 0.6rem', background: 'rgba(13,13,13,0.8)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '999px', fontSize: '0.6rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent-gold)' }}>
                  {categoryLabel}
                </div>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '2.5rem 1rem 0.9rem', background: 'linear-gradient(to top, rgba(13,13,13,0.92), rgba(13,13,13,0))' }}>
                  <span className="brand-label">{fields.brand.trim() || DEFAULT_BRAND}</span>
                  <p className="font-display" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-neutral-light)', margin: '0.2rem 0 0.25rem' }}>
                    {fields.name.trim() || 'Product name'}
                  </p>
                  <p className="price-display" style={{ fontSize: '0.85rem' }}>
                    {zar || 'R --'} <span style={{ opacity: 0.6 }}>|</span> {mwk || 'MK --'}
                  </p>
                </div>
              </div>

              {/* All photos: reorder, remove, add */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MAX_PHOTOS}, minmax(0, 1fr))`, gap: '0.5rem', width: 'min(100%, 300px)', margin: '0.85rem auto 0' }}>
                {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                  const ph = photos[i];
                  if (ph) {
                    return (
                      <div key={ph.key} data-testid="photo-tile" style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${i === 0 ? 'var(--color-accent-gold)' : 'rgba(142,142,147,0.3)'}`, background: '#111' }}>
                        <img src={ph.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        {i === 0 && (
                          <span className="font-mono" style={{ position: 'absolute', top: '3px', left: '3px', fontSize: '0.5rem', letterSpacing: '0.1em', background: 'var(--color-accent-gold)', color: '#0D0D0D', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>MAIN</span>
                        )}
                        <button type="button" aria-label={`Remove photo ${i + 1}`} disabled={uploading} onClick={() => removeAt(i)}
                          style={{ ...tileBtn, position: 'absolute', top: '3px', right: '3px', color: '#f87171' }}>
                          <X size={12} />
                        </button>
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '3px', display: 'flex', justifyContent: 'space-between', padding: '0 3px' }}>
                          <button type="button" aria-label={`Move photo ${i + 1} left`} disabled={uploading || i === 0} onClick={() => move(i, -1)}
                            style={{ ...tileBtn, opacity: i === 0 ? 0.25 : 1 }}><ChevronLeft size={13} /></button>
                          <button type="button" aria-label={`Move photo ${i + 1} right`} disabled={uploading || i === photos.length - 1} onClick={() => move(i, 1)}
                            style={{ ...tileBtn, opacity: i === photos.length - 1 ? 0.25 : 1 }}><ChevronRight size={13} /></button>
                        </div>
                      </div>
                    );
                  }
                  if (i < photos.length + busy) {
                    return (
                      <div key={`busy${i}`} style={{ aspectRatio: '1', borderRadius: '8px', border: '1px dashed rgba(212,175,55,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 size={18} style={{ color: 'var(--color-accent-gold)', animation: 'spin 0.9s linear infinite' }} />
                      </div>
                    );
                  }
                  const canAdd = i === photos.length + busy && room > 0;
                  return (
                    <button key={`empty${i}`} type="button" aria-label={canAdd ? 'Add another photo' : undefined} disabled={!canAdd || uploading} onClick={openGallery}
                      style={{ aspectRatio: '1', borderRadius: '8px', border: '1px dashed rgba(142,142,147,0.35)', background: 'transparent', color: 'var(--color-muted-gray)', cursor: canAdd ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canAdd ? 1 : 0.45 }}>
                      {canAdd ? <Plus size={18} /> : null}
                    </button>
                  );
                })}
              </div>

              <div style={{ width: 'min(100%, 300px)', margin: '0.7rem auto 0' }}>
                <p className="font-mono" style={{ fontSize: '0.66rem', color: 'var(--color-muted-gray)', letterSpacing: '0.04em', lineHeight: 1.6 }}>
                  {photos.length} of {MAX_PHOTOS} photos. The first is the main photo in the shop.
                </p>
                {newPhotos.map((p) => (
                  <p key={p.key} className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--color-muted-gray)', letterSpacing: '0.03em', lineHeight: 1.5, wordBreak: 'break-all' }}>
                    {p.name}: {p.resized
                      ? <>{formatBytes(p.originalSize)} shrunk to {formatBytes(p.size)} ({p.width} x {p.height})</>
                      : <>{formatBytes(p.size)} ({p.width} x {p.height})</>}
                  </p>
                ))}
                {room > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.7rem' }}>
                    {touch && (
                      <button type="button" className="btn-outline-gold" style={{ padding: '0.55rem 0.9rem', fontSize: '0.76rem' }} onClick={openCamera} disabled={uploading}>
                        <Camera size={13} /><span>Take photo</span>
                      </button>
                    )}
                    <button type="button" className="btn-outline-gold" style={{ padding: '0.55rem 0.9rem', fontSize: '0.76rem' }} onClick={openGallery} disabled={uploading}>
                      <ImagePlus size={13} /><span>{touch ? 'From gallery' : 'Add photos'}</span>
                    </button>
                  </div>
                )}
                {room <= 0 && busy === 0 && (
                  <p style={{ fontSize: '0.74rem', color: 'var(--color-muted-gray)', marginTop: '0.6rem' }}>Remove a photo to add a different one.</p>
                )}
              </div>
            </div>
          )}

          <div aria-live="polite">
            {photoMsg && (
              <p className="pf-error-text" role="alert" style={{ fontSize: '0.82rem', marginTop: '0.75rem' }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />{photoMsg}
              </p>
            )}
          </div>
        </section>

        {/* ── 2 and 3. Details and prices ──────────────── */}
        <section aria-labelledby="pf-details-h" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <h3 id="pf-details-h" style={stepStyle}><span style={stepNum}>2</span> Details</h3>

          <div>
            <label htmlFor="name" style={labelStyle}>Product Name *</label>
            <input id="name" name="name" type="text" className={`input-dark ${errors.name ? 'pf-input-error' : ''}`} placeholder="e.g. Classic Slim Tee"
              value={fields.name} onChange={onChange} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-err' : undefined} autoComplete="off" />
            {errors.name && <p id="name-err" className="pf-error-text" role="alert"><AlertCircle size={13} />{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="brand" style={labelStyle}>Brand</label>
            <input id="brand" name="brand" type="text" className="input-dark" placeholder={`e.g. ${DEFAULT_BRAND}`}
              value={fields.brand} onChange={onChange} maxLength={100} autoComplete="off" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.55rem' }}>
              {brandChips.map((b) => (
                <button key={b} type="button"
                  className={`filter-pill ${fields.brand.trim().toLowerCase() === b.toLowerCase() ? 'active' : ''}`}
                  style={{ padding: '0.3rem 0.8rem', fontSize: '0.74rem' }}
                  onClick={() => setField('brand', b)}>
                  {b}
                </button>
              ))}
            </div>
            <p style={{ marginTop: '0.45rem', fontSize: '0.7rem', color: 'var(--color-muted-gray)' }}>Leave blank to list it as {DEFAULT_BRAND}.</p>
          </div>

          <div>
            <span style={labelStyle} id="cat-label">Category *</span>
            <div role="radiogroup" aria-labelledby="cat-label" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {categoryOptions.map(({ id, label }) => {
                const on = fields.category === id;
                return (
                  <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setField('category', id)}
                    style={{
                      flex: '1 1 84px', padding: '0.7rem 0.5rem', borderRadius: '6px', cursor: 'pointer',
                      border: `1px solid ${on ? 'var(--color-accent-gold)' : 'rgba(142,142,147,0.25)'}`,
                      background: on ? 'rgba(212,175,55,0.1)' : 'var(--color-secondary-dark)',
                      color: on ? 'var(--color-accent-gold)' : 'var(--color-muted-gray)',
                      fontSize: '0.85rem', fontFamily: 'var(--font-body)', fontWeight: on ? 600 : 400, transition: 'all 0.2s ease',
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <h3 style={{ ...stepStyle, marginTop: '0.75rem', marginBottom: '0' }}><span style={stepNum}>3</span> Prices (both required)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label htmlFor="price_zar" style={{ ...labelStyle, color: 'var(--color-muted-gray)', marginBottom: '0.3rem' }}>Rand (ZAR)</label>
              <input id="price_zar" name="price_zar" type="number" step="0.01" min="0" inputMode="decimal" placeholder="R 0.00"
                className={`input-dark ${errors.price_zar ? 'pf-input-error' : ''}`} value={fields.price_zar} onChange={onChange} aria-invalid={!!errors.price_zar} />
              {errors.price_zar && <p className="pf-error-text" role="alert"><AlertCircle size={13} />{errors.price_zar}</p>}
            </div>
            <div>
              <label htmlFor="price_mwk" style={{ ...labelStyle, color: 'var(--color-muted-gray)', marginBottom: '0.3rem' }}>Kwacha (MWK)</label>
              <input id="price_mwk" name="price_mwk" type="number" step="0.01" min="0" inputMode="decimal" placeholder="MK 0.00"
                className={`input-dark ${errors.price_mwk ? 'pf-input-error' : ''}`} value={fields.price_mwk} onChange={onChange} aria-invalid={!!errors.price_mwk} />
              {errors.price_mwk && <p className="pf-error-text" role="alert"><AlertCircle size={13} />{errors.price_mwk}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="description" style={labelStyle}>Description (optional)</label>
            <textarea id="description" name="description" className="input-dark" placeholder="Fabric, fit, colours available..." rows={3}
              value={fields.description} onChange={onChange} style={{ resize: 'vertical', minHeight: '84px' }} />
          </div>
        </section>

        {/* ── Submit bar (sticks to the bottom on phones) ── */}
        <div className="pf-submitbar" aria-live="polite">
          {submitError && (
            <div role="alert" style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.75rem 0.9rem', marginBottom: '0.7rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', color: '#f87171', fontSize: '0.84rem', lineHeight: 1.45 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ flex: 1 }}>{submitError}</span>
              <button type="button" onClick={() => setSubmitError('')} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}><X size={15} /></button>
            </div>
          )}

          {askNoPhoto && !uploading && (
            <div role="alert" style={{ padding: '0.85rem 0.95rem', marginBottom: '0.7rem', background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '8px' }}>
              <p style={{ color: 'var(--color-neutral-light)', fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.2rem' }}>No photo added yet</p>
              <p style={{ color: 'var(--color-muted-gray)', fontSize: '0.78rem', marginBottom: '0.7rem' }}>Without a photo the shop shows a grey placeholder for this product.</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-gold" style={{ padding: '0.6rem 1rem', fontSize: '0.78rem' }}
                  onClick={() => { setAskNoPhoto(false); document.getElementById('pf-photo-h')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (touch) openCamera(); else openGallery(); }}>
                  <ImagePlus size={14} /><span>Add a photo</span>
                </button>
                <button type="button" className="btn-outline-gold" style={{ padding: '0.6rem 1rem', fontSize: '0.78rem' }} onClick={(e) => submit(e, { withoutPhoto: true })}>
                  <span>Add without photo</span>
                </button>
              </div>
            </div>
          )}

          {uploading ? (
            // distinct keys: without them React reuses the Cancel button DOM node as the submit button mid-click
            <div key="uploading" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-neutral-light)', marginBottom: '0.4rem' }}>
                  <span>{progress >= 100 ? 'Saving...' : 'Uploading...'}</span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(142,142,147,0.2)', overflow: 'hidden' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #D4AF37, #AA7C11)', transition: 'width 0.2s ease' }} />
                </div>
              </div>
              <button key="cancel-upload" type="button" onClick={cancelUpload} className="btn-outline-gold" style={{ padding: '0.6rem 1rem', fontSize: '0.78rem' }}>Cancel</button>
            </div>
          ) : (
            <div key="idle" style={{ display: 'flex', gap: '0.6rem' }}>
              {isEdit && (
                <button type="button" className="btn-outline-gold" onClick={cancelEdit} style={{ padding: '0.95rem 1.25rem', fontSize: '0.85rem' }}>
                  <span>Cancel</span>
                </button>
              )}
              <button key="submit" type="submit" className="btn-gold" disabled={busy > 0}
                style={{ flex: 1, justifyContent: 'center', padding: '0.95rem', fontSize: '0.9rem', opacity: busy > 0 ? 0.6 : 1 }}>
                {isEdit ? <CheckCircle2 size={16} /> : <PlusCircle size={16} />}
                <span>{busy > 0 ? 'Preparing photos...' : submitError ? 'Try again' : isEdit ? 'Save changes' : 'Add to inventory'}</span>
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
