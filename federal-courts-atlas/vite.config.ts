import { defineConfig } from 'vite';

// Relative base + hash routing: dist/ works when served from any subpath
// (e.g. https://example.org/some/folder/). All data fetches are resolved
// against import.meta.env.BASE_URL, never against "/".
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    // three.js is only imported by the courtroom page, so it lands in that page's chunk.
    chunkSizeWarningLimit: 700,
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
