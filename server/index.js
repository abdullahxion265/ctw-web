const express = require('express');
const cors = require('cors');
const path = require('path');

const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/app');
const { apiNotFound, errorHandler } = require('./middleware/errors');

const isProd = process.env.NODE_ENV === 'production';
const app = express();
const PORT = process.env.PORT || 5000;
// In production the API sits behind the web server on the same machine: listen on loopback only.
const HOST = process.env.HOST || (isProd ? '127.0.0.1' : undefined);

app.disable('x-powered-by');

// Client IP behind the web server. The login rate limiter keys on req.ip, so this must be right.
// Default 1 = trust only Apache on this machine (spoof-proof). If a provider proxy sits in front of
// Apache and every visitor shows the same IP in the logs, set TRUST_PROXY_HOPS=2 (see README).
const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? (isProd ? 1 : 0));
if (proxyHops > 0) app.set('trust proxy', proxyHops);

// Production serves site and API from one origin, so CORS stays off unless CORS_ORIGIN is set.
const corsOrigin = process.env.CORS_ORIGIN || (isProd ? false : 'http://localhost:5173');
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/app', appRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', apiNotFound);
app.use(errorHandler);

app.listen(PORT, HOST, () => {
  console.log(`[Server] listening on ${HOST || '0.0.0.0'}:${PORT} (${isProd ? 'production' : 'development'})`);
});
