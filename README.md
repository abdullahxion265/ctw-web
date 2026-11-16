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

- **Photos:** up to 4 per product, all optional. Take photo (phones), choose several from the gallery or files at once, or drop images on desktop. The first photo is the main one shown in the shop. Use the arrows on each thumbnail to reorder and the X to remove. Photos are resized in the browser to 1600px and re-encoded as JPEG (target under 900 KB), so 5 to 15 MB phone photos upload quickly on mobile data and never hit a size limit. Rotation from the phone camera is applied. Code: `client/src/utils/image.js`.
- **Preview:** shown framed like a shop card with the brand, name and both prices updating live.
- **Submit:** missing fields are flagged under each box, a product with no photo asks first ("Add a photo" or "Add without photo"), upload progress is shown with a Cancel button, and network or server errors give a clear message with Try again. Code: `client/src/components/ProductForm.jsx`, `client/src/utils/upload.js`.
- **After saving:** Add another product keeps the brand and category for the next one.

### Editing a product

Every row in the Inventory tab has an **Edit** button. It opens the same form, prefilled:

- Change any field: name, brand, category, both prices, description.
- **Photos:** all current photos are shown. Reorder, remove or add (up to 4 in total). Photos you remove are deleted from the server after the save succeeds.
- **Cancel** asks before discarding unsaved changes.
- Products from before the dual-currency change that have no Rand price show "R: not set" in the list. Editing one requires entering the Rand price, which fixes it.
- A retired Kids product can still be edited and keeps its category, but Kids cannot be chosen for any other product.

API: `PUT /api/products/:id` (admin only) takes the same multipart fields as create, plus up to 4 `images` files and an `image_order` JSON list (existing photo URLs and `new:0`, `new:1` for the uploaded files, in the wanted order). Anything not listed is removed. The older single `image` and `remove_image=1` fields still work when `image_order` is absent. Code: `server/routes/products.js`, `client/src/components/ProductForm.jsx`.

## Photos per product

Each product has up to 4 photos. The API returns them as `images` (ordered, first = main) and still returns `image_url` (the first photo) for older clients. Storage is the `product_images` table (migration `003`, and `setup.sql` for new installs); files stay in `server/uploads`. If the table is missing the shop falls back to `image_url`, so a forgotten migration does not take the shop down, but saving products with photos will fail until it is run.

In the shop: product cards show a swipeable strip with dots and a "3 photos" label (arrows on hover for mouse users), and the product popup shows a gallery with thumbnails, arrows and keyboard support. Code: `client/src/components/ImageCarousel.jsx`.

## Upload size budget (compression)

The host's front server may reject large requests (HTTP 413), and one product can send up to 4 photos at once. So the admin form keeps every upload inside a total size budget (`client/src/utils/uploadBudget.js`, `client/src/utils/image.js`):

- **Default budget: 900 KB per request**, shared by the new photos. One photo may use about 650 KB; two about 420 KB each; four about 210 KB each (and a smaller maximum size, 1024px instead of 1600px). Photos are re-encoded from the original file at submit, so quality is only reduced as much as needed.
- **Automatic retry:** if the server still answers 413, the budget is halved (900, then 450, then 240 KB) and the upload is retried without the admin doing anything. After the smallest size fails the form says to ask the host to raise the upload size limit.
- **Remembered for a week:** after a 413 the lower budget is stored in the browser, so the next product does not fail first. After 7 days it resets to the default, in case the host raised the limit.
- Dropped connections are not treated as size problems (no shrinking, the admin just sees "Could not reach the server" and Try again).
- If the host raises its limit, raise `DEFAULT_TOTAL_BYTES` in `uploadBudget.js` for sharper photos. Editing a product only counts the NEW photos, existing ones are never re-sent.

## Android app (APK) downloads

Admins publish the Android app from **Admin > App (APK)**; customers download it from the website and install it directly (sideloading).

- **Upload:** choose the .apk, enter a version name (for example 1.2.0) and optional notes. The file is sent in small pieces (700 KB each, one request per piece), so the host's request-size limit never matters. The browser retries a failed piece, resumes from the server's position, and halves the piece size automatically if the server answers 413 (remembered for a week). Code: `client/src/utils/apkUpload.js`.
- **Checks on the server:** the file must be a zip that contains `AndroidManifest.xml`, at most `APK_MAX_MB` (default 200). The SHA-256 is computed and shown. The exact same APK cannot be uploaded twice. Uploads left unfinished are deleted after 24 hours.
- **Releases:** the newest upload becomes the current download. Older releases stay listed (you can make one current again or delete it). The 5 newest are kept (`APK_KEEP_RELEASES`), older files are deleted automatically.
- **Where files live:** `server/apk/` on the server. It is not in the zip and is never served as a static folder: the only way to get the file is `/api/app/download`. Back this folder up if you want to keep old releases.
- **Public pages:** a "Get the App" card on the home page, an `/app` page with install steps and the checksum, and an "Android app" footer link. All of it stays hidden until the first APK is uploaded.
- **Download limits** (`server/middleware/apkLimiter.js`, per visitor IP): 5 downloads per hour and 20 per day, at most 2 at the same time, 25 at once for the whole server. Resuming an interrupted download and HEAD checks are not counted. Over the limit, browsers see a "Download limit reached" page and apps get JSON with `Retry-After`. Change the numbers with `APK_DOWNLOADS_PER_HOUR`, `APK_DOWNLOADS_PER_DAY`, `APK_CONCURRENT_PER_IP`, `APK_MAX_CONCURRENT` in `ecosystem.config.js`.
- **Client IP:** the limits use the IP Express sees. See `TRUST_PROXY_HOPS` above: if a provider proxy sits in front of Apache and every visitor shows the same IP in `pm2 logs` (`[apk] download ... from <ip>`), set `TRUST_PROXY_HOPS=2`, otherwise all visitors would share one limit.
- **API:** `GET /api/app/latest` (public: `available`, `version`, `notes`, `size`, `sha256`, `downloadUrl`), `GET /api/app/download` (public, limited), admin: `POST /api/app/uploads`, `PUT /api/app/uploads/:id?offset=N`, `POST /api/app/uploads/:id/complete`, `DELETE /api/app/uploads/:id`, `GET /api/app/releases`, `PUT /api/app/releases/:id/current`, `DELETE /api/app/releases/:id`.
- **Database:** migration `004_app_releases.sql` (and `setup.sql` for new installs). If the table is missing the shop keeps working and the download section just stays hidden.

## Contact email

The shop's public address is `CONTACT_EMAIL` in `client/src/config.js` (`info@carterthetownwear.com`). It is shown as plain text, deliberately not a link, in the home page strip ("Questions? Email us") and in the footer. `client/index.html` also tells phones not to turn it into a link. Change it in `config.js` and rebuild.

## Follow Us, delivery and footer

- **Follow Us:** a section on the home page (heading and four cards reading "Follow on <platform>", no handles) plus icons in the site footer (Instagram, TikTok, Facebook, Threads). Edit the links in `SOCIAL_LINKS` in `client/src/config.js` and rebuild. The Facebook link is a post link; replace it with the page link when available.
- **Delivery:** "Delivery available" is shown on the home page, in the product popup, in the cart (with a prompt to put the delivery location in the notes) and in the footer. The wording is `DELIVERY` in `client/src/config.js`. No fees, locations or timings are promised on the site.
- **Footer:** one footer for the whole site (`client/src/components/Footer.jsx`), hidden on admin pages.

## Brands

Each product has a brand. In the admin form the Brand box suggests **CTW** (the shop's own label) as a one-tap chip, together with brands already used. The admin can type any other brand. Leaving it blank lists the product as `CTW`. The brand shows on cards, in the product popup, in the Browse brand filter and in the WhatsApp messages. The default lives in `DEFAULT_BRAND` (`client/src/config.js`) and `DEFAULT_BRAND` in `server/routes/products.js`.

## Cart (WhatsApp checkout)

- Shoppers add products with the + button on a card or Add to cart in the product popup. The cart icon in the navbar shows the quantity and opens the cart drawer.
- The cart lives in the browser (`localStorage`). When it opens it refreshes prices from `GET /api/products?ids=1,2,3` and drops products that were deleted.
- Totals use the selected currency (Rand or Kwacha). A product with no price in that currency shows "Price on request" and is left out of the total.
- Sizes, colours and other details go in the notes box. **Order via WhatsApp** opens one message with every item, quantity, line total, the total and the notes. There is no payment or order record on the server; the order is agreed in the chat.
- Logic is in `client/src/utils/cart.js`, state in `client/src/context/CartContext.jsx`, UI in `client/src/components/CartDrawer.jsx`.

## Upgrading an existing database

Run each migration once, in order, as DB root, before deploying the release that needs it (001 and 002 may already be applied; 003 adds multiple photos, 004 adds the APK releases table):
`sudo mysql < server/migrations/003_product_images.sql`
`sudo mysql < server/migrations/004_app_releases.sql`

Earlier note: run each migration once, in order, as DB root: `sudo mysql < server/migrations/002_categories_hoodies_caps_shoes.sql` (001 is already applied on the live server).

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

