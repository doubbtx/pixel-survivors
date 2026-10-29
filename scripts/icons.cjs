/**
 * Ikony gry z grafiki proceduralnej: bohaterka (Kestra) na ciemnym tle z ciepłą poświatą, w pikselowym powiększeniu.
 * Zapisuje public/icon-512.png, icon-192.png, apple-touch-icon.png (180) i favicon-32.png (Vite kopiuje public/ do dist).
 *
 *   npm run dev            (w drugim terminalu)
 *   node scripts/icons.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const url = 'http://localhost:5173/';
const out = path.join(__dirname, '..', 'public');
const SIZES = [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['favicon-32.png', 32]];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(url);
  await p.waitForTimeout(1200);
  fs.mkdirSync(out, { recursive: true });
  for (const [name, size] of SIZES) {
    const data = await p.evaluate(async (size) => {
      const m = await import('/src/gfx/sprites.ts');
      const { PAL, C } = await import('/src/core/palette.ts');
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      // Tło: zaokrąglony kwadrat, nocny gradient i ciepła poświata za postacią.
      const rad = size * 0.18;
      g.beginPath();
      g.roundRect(0, 0, size, size, rad);
      g.clip();
      const bg = g.createLinearGradient(0, 0, 0, size);
      bg.addColorStop(0, PAL[C.navy]);
      bg.addColorStop(1, PAL[C.black]);
      g.fillStyle = bg;
      g.fillRect(0, 0, size, size);
      const glow = g.createRadialGradient(size / 2, size * 0.58, 0, size / 2, size * 0.58, size * 0.48);
      glow.addColorStop(0, PAL[C.orange]);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.55;
      g.fillStyle = glow;
      g.fillRect(0, 0, size, size);
      g.globalAlpha = 1;
      // Ziemia: ciemna elipsa cienia pod stopami.
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.ellipse(size / 2, size * 0.86, size * 0.26, size * 0.05, 0, 0, Math.PI * 2);
      g.fill();
      // Bohaterka w całości, wyśrodkowana, możliwie duża (favicon: tylko głowa i tułów).
      const s = m.getSprite('kestra@0');
      const small = size < 64;
      const k = small ? size / (s.w * 0.62) : (size * 0.78) / s.h;
      const w = s.w * k, h = s.h * k;
      g.drawImage(s.img, (size - w) / 2, small ? size * 0.04 : size * 0.88 - h, w, h);
      // Ramka w kolorze złota.
      g.lineWidth = Math.max(1, size * 0.02);
      g.strokeStyle = PAL[C.gold];
      g.beginPath();
      g.roundRect(g.lineWidth / 2, g.lineWidth / 2, size - g.lineWidth, size - g.lineWidth, rad);
      g.stroke();
      return c.toDataURL('image/png');
    }, size);
    fs.writeFileSync(path.join(out, name), Buffer.from(data.split(',')[1], 'base64'));
    console.log(name, size);
  }
  await b.close();
})();
