# CarterTheTownWear

A modern, premium clothing e-commerce platform (Men, Women, Hoodies, Caps, Shoes) built with React, Express, and MySQL. Orders are placed over WhatsApp.

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + Lucide React
- **Backend:** Node.js + Express + JWT Auth + Bcrypt
- **Database:** MySQL via XAMPP
- **Images:** Multer → `/server/uploads/` (path stored in DB)

## Color Palette

| Token          | Hex       |
|----------------|-----------|
| Primary Dark   | `#0D0D0D` |
| Secondary Dark | `#1A1A1A` |
| Accent Gold    | `#D4AF37` |
| Muted Gold     | `#AA7C11` |
| Neutral Light  | `#F5F5F7` |
| Muted Gray     | `#8E8E93` |

## Local development

Requires Node 18+ and MySQL/MariaDB (XAMPP works).

```bash
# 1. Database (schema, then sample data and a local admin)
mysql -u root < setup.sql
mysql -u root < seed.dev.sql      # LOCAL ONLY: never run on production

# 2. API (http://localhost:5000)
cd server && npm install && npm run dev

# 3. Client (http://localhost:5173)
cd client && npm install && npm run dev
```

Local admin from `seed.dev.sql`: `admin@carterthetown.com` / `password`. This account exists only on dev databases.

## Production requirements

- Production builds fail unless `client/.env.production` has a real `VITE_WHATSAPP_NUMBER` (digits only, international format, for example `27821234567`).
- In production the API refuses to start unless `JWT_SECRET`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` are set. It listens on `127.0.0.1` only, and CORS is off unless `CORS_ORIGIN` is set.
- `setup.sql` is schema only. Create the first admin with `bash deploy/create-admin.sh` (asks for name, email and password).

## Production Deployment

Server env vars (see `server/ecosystem.config.example.js`): `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET` (required in production), `CORS_ORIGIN`, `PORT`.

- Apache vhosts: `deploy/apache.carterthetownwear.conf` (HTTP, pre-SSL) and `deploy/apache.carterthetownwear-ssl.conf` (HTTPS). Nginx alternative: `deploy/nginx.carterthetownwear.conf`
- Static build is published to `/var/www/carterthetownwear`; `/api` and `/uploads` proxy to Node on :5000
- Build/publish/restart in one go: `bash deploy/update.sh`

## Login protection and error handling

- **Rate limit:** `POST /api/auth/login` allows 10 failed attempts per IP per 15 minutes. After that the IP gets HTTP 429 until the window passes, even with the right password. Successful logins are not counted. Failed logins and blocks are logged as `[auth] ...` lines with the IP (`pm2 logs`).
- **Client IP behind the web server:** the limiter uses the IP Express sees. `TRUST_PROXY_HOPS` (default `1` in production) says how many proxies to trust. With Apache on the same machine, `1` is correct and cannot be spoofed. If a provider proxy sits in front of Apache and every failed login shows the same non-client IP in the logs, set `TRUST_PROXY_HOPS=2` in `ecosystem.config.js` and restart with `--update-env`. Do not set 2 unless the logs show it is needed: with no extra proxy it lets attackers bypass the limit.
- **Errors:** the API always returns JSON errors: friendly messages for wrong image type, oversize image (8 MB limit), malformed requests and unknown routes; unexpected failures return a generic message and the details go to the server log only. The admin form also checks image type and size in the browser before uploading.

## Pages & Routes

| Route          | Description                              |
|----------------|------------------------------------------|
| `/`            | Landing — Hero + Our Picks Today         |
| `/browse`      | Full catalog: category tabs, brand filter, search, pagination, add to cart |
| `/admin/login` | Admin login (JWT auth)                   |
| `/admin`       | Protected dashboard — add/manage products|

## API Endpoints

| Method | Endpoint               | Auth     | Description                   |
|--------|------------------------|----------|-------------------------------|
| POST   | `/api/auth/login`      | None     | Admin login → JWT             |
| GET    | `/api/auth/me`         | Bearer   | Verify token                  |
| GET    | `/api/products`        | None     | List products (filter + page) |
| GET    | `/api/products/picks`  | None     | 3 random picks                |
| GET    | `/api/products/brands` | None     | Distinct brand list           |
| GET    | `/api/products/:id`    | None     | Single product                |
| PUT    | `/api/products/:id`    | Admin    | Edit a product (same fields as create, optional new image, `remove_image=1`) |
| POST   | `/api/products`        | Admin    | Create product + upload image |
| DELETE | `/api/products/:id`    | Admin    | Delete product + image file   |

## Product Categories

Products are tagged **Men**, **Women**, **Hoodies**, **Caps** or **Shoes** when created, and filterable on the Browse page. Kids is retired: it stays in the database enum for rollback safety, but the API rejects it and the UI no longer shows it. Delete any leftover Kids products in the admin panel.

## Adding products (admin)

The Add Product tab is photo-first: 1 Photo, 2 Details, 3 Prices, then the submit button, which sticks to the bottom of the screen on phones.

- **Photo:** Take photo (phones) or choose from the gallery or files, or drop an image on desktop. Photos are resized in the browser to 1600px and re-encoded as JPEG (target under 900 KB), so 5 to 15 MB phone photos upload quickly on mobile data and never hit a size limit. Rotation from the phone camera is applied. Code: `client/src/utils/image.js`.
- **Preview:** shown framed like a shop card with the brand, name and both prices updating live.
- **Submit:** missing fields are flagged under each box, a product with no photo asks first ("Add a photo" or "Add without photo"), upload progress is shown with a Cancel button, and network or server errors give a clear message with Try again. Code: `client/src/components/ProductForm.jsx`, `client/src/utils/upload.js`.
- **After saving:** Add another product keeps the brand and category for the next one.

### Editing a product

Every row in the Inventory tab has an **Edit** button. It opens the same form, prefilled:

- Change any field: name, brand, category, both prices, description.
- **Photo:** the current photo is kept unless you Replace it (the new one is resized like any upload, and the old file is deleted from the server after the save succeeds) or Remove it. Choosing a new photo can be undone with Keep current photo.
- **Cancel** asks before discarding unsaved changes.
- Products from before the dual-currency change that have no Rand price show "R: not set" in the list. Editing one requires entering the Rand price, which fixes it.
- A retired Kids product can still be edited and keeps its category, but Kids cannot be chosen for any other product.

API: `PUT /api/products/:id` (admin only) takes the same multipart fields as create, plus an optional `image` to replace the photo or `remove_image=1` to clear it. Code: `server/routes/products.js`, `client/src/components/ProductForm.jsx`.

## Brands

Each product has a brand. In the admin form the Brand box suggests **CTW** (the shop's own label) as a one-tap chip, together with brands already used. The admin can type any other brand. Leaving it blank lists the product as `CTW`. The brand shows on cards, in the product popup, in the Browse brand filter and in the WhatsApp messages. The default lives in `DEFAULT_BRAND` (`client/src/config.js`) and `DEFAULT_BRAND` in `server/routes/products.js`.

## Cart (WhatsApp checkout)

- Shoppers add products with the + button on a card or Add to cart in the product popup. The cart icon in the navbar shows the quantity and opens the cart drawer.
- The cart lives in the browser (`localStorage`). When it opens it refreshes prices from `GET /api/products?ids=1,2,3` and drops products that were deleted.
- Totals use the selected currency (Rand or Kwacha). A product with no price in that currency shows "Price on request" and is left out of the total.
- Sizes, colours and other details go in the notes box. **Order via WhatsApp** opens one message with every item, quantity, line total, the total and the notes. There is no payment or order record on the server; the order is agreed in the chat.
- Logic is in `client/src/utils/cart.js`, state in `client/src/context/CartContext.jsx`, UI in `client/src/components/CartDrawer.jsx`.

## Upgrading an existing database

Run each migration once, in order, as DB root: `sudo mysql < server/migrations/002_categories_hoodies_caps_shoes.sql` (001 is already applied on the live server).

## Structure

```
CarterTheTownWear/
├── .gitignore
├── README.md
├── setup.sql
├── client/
│   ├── src/
│   │   ├── config.js             ← WhatsApp number + constants
│   │   ├── context/AuthContext   ← JWT session management
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── ProductCard.jsx   ← opens modal on View/Quick View
│   │   │   ├── ProductModal.jsx  ← detail + WhatsApp CTA
│   │   │   ├── SkeletonCard.jsx
│   │   │   └── Toast.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx          ← hero + picks
│   │   │   ├── Browse.jsx        ← full catalog + filters + pagination
│   │   │   ├── AdminLogin.jsx
│   │   │   └── Admin.jsx
│   │   └── index.css             ← design system
└── server/
    ├── middleware/auth.js         ← JWT verify + admin guard
    ├── routes/auth.js
    ├── routes/products.js
    ├── db.js
    ├── index.js
    └── uploads/
```

## Dual-currency pricing (ZAR + MWK)

- Each product stores two prices: `price_zar` (Rand) and `price_mwk` (Kwacha). The admin form requires both and the API rejects a product missing either.
- Shoppers switch between Rand and Kwacha with the toggle in the navbar. The choice is remembered in the browser. The WhatsApp order message uses the selected currency.
- Default currency before a visitor chooses: `ZAR`. Change with `VITE_DEFAULT_CURRENCY=MWK` in `client/.env.production`, then rebuild.
- **Existing database:** run `sudo mysql < server/migrations/001_dual_currency.sql` once. Existing prices become Kwacha; Rand shows "Price on request" until set. The legacy `price` column is kept as a mirror of `price_mwk` so a rollback to the previous release still works. Drop it in a later release.
- Fresh installs: `setup.sql` already has the new columns.

