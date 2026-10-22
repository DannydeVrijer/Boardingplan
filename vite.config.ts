import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' zodat de build ook werkt op GitHub Pages (subpad) en lokaal als bestand.
export default defineConfig({
  plugins: [react()],
  base: './',
});
