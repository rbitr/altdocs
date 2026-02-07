import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Parse JSON request bodies
app.use(express.json());

// Mount API routes
app.use(apiRouter);

// Serve static files from the built client directory
const clientDir = path.resolve(__dirname, '../../dist/client');
app.use(express.static(clientDir));

// Fallback to index.html for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AltDocs server running on http://localhost:${PORT}`);
});

export { app };
