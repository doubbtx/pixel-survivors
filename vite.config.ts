import { defineConfig } from 'vite';

// base: './' — względne ścieżki, żeby build działał na GitHub Pages / itch.io z dowolnego katalogu.
export default defineConfig({
  base: './',
  build: { target: 'es2020', outDir: 'dist' },
});
