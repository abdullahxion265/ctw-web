const multer = require('multer');

const MAX_UPLOAD_MB = 8;

// Unknown /api routes: JSON instead of Express's HTML "Cannot GET ..."
function apiNotFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Last-resort error handler: always JSON, never a stack trace.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Image is too large. Maximum size is ${MAX_UPLOAD_MB} MB.` });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file upload. Send a single image.' });
    }
    return res.status(400).json({ error: 'Upload failed. Check the image and try again.' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large.' });
  }

  // Deliberate, user-safe errors thrown elsewhere (for example the image type filter)
  if (err.expose && err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

module.exports = { apiNotFound, errorHandler, MAX_UPLOAD_MB };
