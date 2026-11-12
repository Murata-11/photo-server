import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'appearance-before-paint',
      transformIndexHtml() {
        return [
          {
            tag: 'script',
            children: readFileSync(
              new URL('./src/appearance-bootstrap.js', import.meta.url),
              'utf8',
            ),
            injectTo: 'head' as const,
          },
        ];
      },
    },
  ],
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:3000' } },
});
