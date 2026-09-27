import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * Stamps a unique build id into dist/sw.js so each deploy gets a fresh cache
 * and the service worker cleans up the old one.
 */
function serviceWorkerBuildId() {
  return {
    name: 'sw-build-id',
    apply: 'build',
    closeBundle() {
      const file = `${root}dist/sw.js`;
      const id = Date.now().toString(36);
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', id));
    },
  };
}

export default defineConfig({
  // Relative base so the same build works on Netlify (site root) and
  // GitHub Pages (a /repo-name/ sub-folder).
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800, // three.js alone is ~570 kB (≈146 kB gzipped)
    rolldownOptions: {
      input: {
        main: `${root}index.html`,
        micTest: `${root}mic-test.html`,
      },
    },
  },
  plugins: [serviceWorkerBuildId()],
});
