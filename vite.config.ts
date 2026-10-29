import { defineConfig } from 'vite';
import pkg from './package.json';

// base: './' — względne ścieżki, żeby build działał na GitHub Pages / itch.io z dowolnego katalogu.
// `--mode release` (npm run build:release): wersja wydawana bez narzędzi deweloperskich (__DEV_TOOLS__ = false).
export default defineConfig(({ mode }) => ({
  base: './',
  build: { target: 'es2020', outDir: 'dist' },
  // Numer wersji z package.json widoczny w menu głównym (łatwo sprawdzić, czy przeglądarka ma najnowszą grę).
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __DEV_TOOLS__: JSON.stringify(mode !== 'release') },
}));
