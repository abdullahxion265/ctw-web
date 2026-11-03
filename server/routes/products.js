const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { MAX_UPLOAD_MB } = require('../middleware/errors');

// Admin can enter any brand per product. CTW (the shop's own label) is the default when left blank.
const DEFAULT_BRAND = 'CTW';
const MAX_BRAND_LEN = 100;
const CATEGORIES = ['men', 'women', 'hoodies', 'caps', 'shoes'];
const MAX_IDS = 50;
const MAX_IMAGES = 4;

// --- Multer ---
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('Only image files are allowed (JPG, PNG, WebP or GIF).');
    err.status = 400;
    err.expose = true;
    cb(err);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: MAX_IMAGES + 1 } });
// `images` takes up to 4 photos; the older single `image` field is still accepted
const uploadPhotos = upload.fields([{ name: 'images', maxCount: MAX_IMAGES }, { name: 'image', maxCount: 1 }]);

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------
const filesOf = (req) => [...((req.files && req.files.images) || []), ...((req.files && req.files.image) || [])];
const urlOf = (file) => `/uploads/${file.filename}`;
const discardFiles = (files) => files.forEach((f) => fs.unlink(f.path, () => {}));

// Attach `images` (ordered URLs, first = main) to product rows. If the product_images table is missing
// (migration not run yet) fall back to the single image_url so the shop keeps working.
async function withImages(rows) {
  if (!rows.length) return rows;
  let byProduct = new Map();
  try {
    const [imgs] = await db.query(
      'SELECT product_id, url FROM product_images WHERE product_id IN (?) ORDER BY product_id, position',
      [rows.map((r) => r.id)]
    );
    imgs.forEach((i) => {
      if (!byProduct.has(i.product_id)) byProduct.set(i.product_id, []);
      byProduct.get(i.product_id).push(i.url);
    });
  } catch (err) {
    console.error('[photos] product_images unavailable, falling back to image_url:', err.message);
    byProduct = new Map();
  }
  return rows.map((r) => {
    const list = byProduct.get(r.id);
    return { ...r, images: list && list.length ? list : (r.image_url ? [r.image_url] : []) };
  });
}

// Current photos of one product (table first, image_url as a fallback)
async function currentImages(product) {
  const [withList] = await withImages([product]);
  return withList.images;
}

// Replace a product's photo list inside a transaction and keep image_url as the first photo.
async function saveImages(conn, productId, urls) {
  await conn.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
  for (let i = 0; i < urls.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await conn.query('INSERT INTO product_images (product_id, url, position) VALUES (?, ?, ?)', [productId, urls[i], i]);
  }
  await conn.query('UPDATE products SET image_url = ? WHERE id = ?', [urls[0] || null, productId]);
}

// GET /api/products
// Query: category (men|women|hoodies|caps|shoes), ids (comma list, max 50), page, limit
router.get('/', async (req, res) => {
  try {
    const { brand, category, ids, page = 1, limit = 12 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];

    if (brand && brand !== 'all') { where.push('brand = ?'); params.push(brand); }
    if (category && category !== 'all') { where.push('category = ?'); params.push(category); }
    if (ids) {
      // Used by the cart to refresh prices and drop deleted products
      const list = String(ids).split(',').map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n) && n > 0).slice(0, MAX_IDS);
      if (!list.length) return res.json({ products: [], pagination: { total: 0, page: 1, limit: 0, totalPages: 0 } });
      where.push('id IN (?)'); params.push(list);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM products ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await db.query(
      `SELECT * FROM products ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      products: await withImages(rows),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[GET /products]', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/brands
router.get('/brands', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT DISTINCT brand FROM products ORDER BY brand ASC');
    res.json(rows.map((r) => r.brand));
  } catch (err) {
    console.error('[GET /products/brands]', err);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// GET /api/products/picks — 3 random products
router.get('/picks', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products ORDER BY RAND() LIMIT 3');
    res.json(await withImages(rows));
  } catch (err) {
    console.error('[GET /products/picks]', err);
    res.status(500).json({ error: 'Failed to fetch picks' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json((await withImages(rows))[0]);
  } catch (err) {
    console.error('[GET /products/:id]', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ---------------------------------------------------------------------------
// Create / update helpers
// ---------------------------------------------------------------------------
// Both prices are required: price_zar (South African Rand) and price_mwk (Malawian Kwacha).
const MAX_PRICE = 99999999.99; // DECIMAL(10,2)
const MAX_DESCRIPTION_LEN = 2000;

// Validate and normalise the product fields shared by create and update.
// `keepCategory` lets an existing product keep a retired category (kids) when it is unchanged.
function readProductFields(body, keepCategory) {
  const name = String(body.name || '').trim();
  if (!name) return { error: 'Product name is required' };

  const brand = String(body.brand || '').trim() || DEFAULT_BRAND;
  if (brand.length > MAX_BRAND_LEN) return { error: `Brand must be ${MAX_BRAND_LEN} characters or fewer` };

  const zar = Number(body.price_zar);
  const mwk = Number(body.price_mwk);
  const validPrice = (n) => Number.isFinite(n) && n > 0 && n <= MAX_PRICE;
  if (!validPrice(zar) || !validPrice(mwk)) {
    return { error: 'Both prices are required: Rand (ZAR) and Kwacha (MWK), each greater than 0' };
  }

  const category = body.category || keepCategory || 'men';
  if (!CATEGORIES.includes(category) && category !== keepCategory) {
    return { error: `Category must be one of: ${CATEGORIES.join(', ')}` };
  }

  const description = String(body.description || '').trim();
  if (description.length > MAX_DESCRIPTION_LEN) {
    return { error: `Description must be ${MAX_DESCRIPTION_LEN} characters or fewer` };
  }

  return { values: { name, brand, category, zar, mwk, description: description || null } };
}

// Delete an uploaded image from disk. Only ever touches files inside the uploads folder.
function removeUpload(imageUrl) {
  if (!imageUrl) return;
  const file = path.join(uploadDir, path.basename(imageUrl));
  fs.unlink(file, () => {});
}

// POST /api/products — admin only
// Multipart: name, brand, category, price_zar, price_mwk, description, and up to 4 `images` (first = main).
router.post('/', requireAuth, requireAdmin, uploadPhotos, async (req, res) => {
  const files = filesOf(req);
  // Remove the already-saved uploads if we reject the request
  const reject = (status, error) => {
    discardFiles(files);
    return res.status(status).json({ error });
  };

  try {
    const parsed = readProductFields(req.body);
    if (parsed.error) return reject(400, parsed.error);
    if (files.length > MAX_IMAGES) return reject(400, `You can add up to ${MAX_IMAGES} photos per product.`);
    const v = parsed.values;
    const urls = files.map(urlOf);

    const conn = await db.getConnection();
    let productId;
    try {
      await conn.beginTransaction();
      // `price` is the legacy column, kept as a mirror of price_mwk (see migrations/001)
      const [result] = await conn.query(
        'INSERT INTO products (name, brand, category, price, price_mwk, price_zar, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [v.name, v.brand, v.category, v.mwk, v.mwk, v.zar, v.description, urls[0] || null]
      );
      productId = result.insertId;
      await saveImages(conn, productId, urls);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const [created] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);
    res.status(201).json((await withImages(created))[0]);
  } catch (err) {
    discardFiles(files);
    console.error('[POST /products]', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id — admin only
// Same fields as create. Photos are set with `image_order`, a JSON list in the wanted order where each
// entry is either an existing photo URL of this product or "new:0", "new:1" (the uploaded `images`, in order).
// Anything not listed is removed. Without image_order the old rules apply: a new `image` replaces all
// photos, remove_image=1 clears them, otherwise photos are kept. Removed files are deleted only after
// the update succeeds.
router.put('/:id', requireAuth, requireAdmin, uploadPhotos, async (req, res) => {
  const files = filesOf(req);
  const reject = (status, error) => {
    discardFiles(files);
    return res.status(status).json({ error });
  };

  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return reject(404, 'Product not found');

    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    if (!rows.length) return reject(404, 'Product not found');
    const existing = rows[0];
    const existingUrls = await currentImages(existing);

    const parsed = readProductFields(req.body, existing.category);
    if (parsed.error) return reject(400, parsed.error);
    const v = parsed.values;

    // Work out the final ordered photo list
    let finalUrls;
    const usedFiles = new Set();
    if (req.body.image_order !== undefined) {
      let order;
      try { order = JSON.parse(req.body.image_order); } catch { return reject(400, 'The photo list is not valid.'); }
      if (!Array.isArray(order)) return reject(400, 'The photo list is not valid.');
      finalUrls = [];
      for (const entry of order) {
        if (typeof entry !== 'string') return reject(400, 'The photo list is not valid.');
        if (entry.startsWith('new:')) {
          const n = Number(entry.slice(4));
          if (!Number.isInteger(n) || n < 0 || n >= files.length || usedFiles.has(n)) return reject(400, 'The photo list is not valid.');
          usedFiles.add(n);
          finalUrls.push(urlOf(files[n]));
        } else {
          if (!existingUrls.includes(entry) || finalUrls.includes(entry)) return reject(400, 'The photo list is not valid.');
          finalUrls.push(entry);
        }
      }
    } else if (files.length) {
      finalUrls = files.map(urlOf);
      files.forEach((_f, i) => usedFiles.add(i));
    } else if (['1', 'true'].includes(String(req.body.remove_image))) {
      finalUrls = [];
    } else {
      finalUrls = existingUrls;
    }
    if (finalUrls.length > MAX_IMAGES) return reject(400, `You can add up to ${MAX_IMAGES} photos per product.`);

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'UPDATE products SET name = ?, brand = ?, category = ?, price = ?, price_mwk = ?, price_zar = ?, description = ? WHERE id = ?',
        [v.name, v.brand, v.category, v.mwk, v.mwk, v.zar, v.description, id]
      );
      await saveImages(conn, id, finalUrls);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    // Success: delete photos that are no longer used, and uploads that were not referenced
    existingUrls.filter((u) => !finalUrls.includes(u)).forEach(removeUpload);
    discardFiles(files.filter((_f, i) => !usedFiles.has(i)));

    const [updated] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    res.json((await withImages(updated))[0]);
  } catch (err) {
    discardFiles(files);
    console.error('[PUT /products/:id]', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id — admin only
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });

    const urls = await currentImages(rows[0]);
    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);   // product_images rows go with it
    urls.forEach(removeUpload);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('[DELETE /products/:id]', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
