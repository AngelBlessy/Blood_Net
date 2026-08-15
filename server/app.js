const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const fs = require('node:fs');
const apiRouter = require('./routes');
const { errorHandler } = require('./middleware/error-handler');
const { env } = require('./config/env');

const CLIENT_DIST_DIR = path.join(__dirname, '..', 'client', 'dist');

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // The client is deployed separately (Vercel) from this API (Fly.io), so
  // requests are cross-origin. credentials: true is required for the
  // httpOnly auth cookie to be sent/accepted; when no CLIENT_ORIGIN is
  // configured (local dev, where Vite proxies requests same-origin) this
  // allows no cross-origin requests at all rather than silently allowing "*".
  if (env.clientOrigins.length > 0) {
    app.use(cors({ origin: env.clientOrigins, credentials: true }));
  }

  // 20kb was enough for the rest of the API, but the bulk /translate endpoint
  // sends the whole UI dictionary (~15kb+ and growing) in one request.
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.use('/api', apiRouter);
  app.use(express.static(CLIENT_DIST_DIR));

  app.get('*', (_req, res) => {
    const indexPath = path.join(CLIENT_DIST_DIR, 'index.html');
    if (!fs.existsSync(indexPath)) {
      res
        .status(503)
        .type('text/plain')
        .send('Client build not found. Run `npm run build` (or `npm run dev` for local development) first.');
      return;
    }
    res.sendFile(indexPath);
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp, CLIENT_DIST_DIR };
