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

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 } });

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
      products: rows,
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
    res.json(rows);
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
    res.json(rows[0]);
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
router.post('/', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  // Remove the already-saved upload if we reject the request
  const reject = (status, error) => {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(status).json({ error });
  };

  try {
    const parsed = readProductFields(req.body);
    if (parsed.error) return reject(400, parsed.error);
    const v = parsed.values;

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // `price` is the legacy column, kept as a mirror of price_mwk (see migrations/001)
    const [result] = await db.query(
      'INSERT INTO products (name, brand, category, price, price_mwk, price_zar, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [v.name, v.brand, v.category, v.mwk, v.mwk, v.zar, v.description, imageUrl]
    );

    const [newProduct] = await db.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(newProduct[0]);
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('[POST /products]', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id — admin only
// Same fields as create. Image: send a new `image` to replace it, or remove_image=1 to clear it;
// otherwise the current image is kept. The old file is deleted only after the update succeeds.
router.put('/:id', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  const reject = (status, error) => {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(status).json({ error });
  };

  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return reject(404, 'Product not found');

    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    if (!rows.length) return reject(404, 'Product not found');
    const existing = rows[0];

    const parsed = readProductFields(req.body, existing.category);
    if (parsed.error) return reject(400, parsed.error);
    const v = parsed.values;

    const removeImage = ['1', 'true'].includes(String(req.body.remove_image));
    let imageUrl = existing.image_url;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;
    else if (removeImage) imageUrl = null;

    await db.query(
      'UPDATE products SET name = ?, brand = ?, category = ?, price = ?, price_mwk = ?, price_zar = ?, description = ?, image_url = ? WHERE id = ?',
      [v.name, v.brand, v.category, v.mwk, v.mwk, v.zar, v.description, imageUrl, id]
    );

    if (existing.image_url && existing.image_url !== imageUrl) removeUpload(existing.image_url);

    const [updated] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('[PUT /products/:id]', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id — admin only
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT image_url FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });

    const imageUrl = rows[0].image_url;
    if (imageUrl) {
      const filePath = path.join(__dirname, '..', imageUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('[DELETE /products/:id]', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
