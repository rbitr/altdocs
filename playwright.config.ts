import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      command: 'npx tsx src/server/index.ts',
      url: 'http://localhost:3000/api/documents',
      reuseExistingServer: !process.env.CI,
      cwd: '.',
      timeout: 10000,
    },
    {
      command: 'npx vite --host 0.0.0.0 --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      cwd: '.',
      timeout: 10000,
    },
  ],
});
