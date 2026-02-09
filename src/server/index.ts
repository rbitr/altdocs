import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './api.js';
import { authRouter, optionalAuth } from './auth.js';
import { uploadRouter, UPLOAD_DIR } from './uploads.js';
import { createCollaborationServer } from './websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Parse JSON request bodies
app.use(express.json());

// Extract user from auth token on all requests
app.use(optionalAuth);

// Mount API routes
app.use(authRouter);
app.use(apiRouter);
app.use(uploadRouter);

// Serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

// Serve static files from the built client directory
const clientDir = path.resolve(__dirname, '../../dist/client');
app.use(express.static(clientDir));

// Fallback to index.html for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Create HTTP server and attach WebSocket collaboration server
const server = http.createServer(app);
const collaborationServer = createCollaborationServer(server);

server.listen(PORT, () => {
  console.log(`AltDocs server running on http://localhost:${PORT}`);
});

export { app, server, collaborationServer };
