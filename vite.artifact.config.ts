import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Eén zelfstandig HTML-bestand (voor weergave als Claude-artifact of offline gebruik).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: { outDir: 'dist-single', emptyOutDir: true },
});
