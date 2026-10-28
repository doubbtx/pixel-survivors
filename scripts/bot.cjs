/**
 * Bot testowy: uruchamia grę na serwerze deweloperskim z `?bot=...` (src/dev/bot.ts) w Chromium (Playwright)
 * i wypisuje raport: runy, błędy, wolne kroki, stany, brakujące tłumaczenia.
 *
 *   npm run dev                      (w drugim terminalu)
 *   node scripts/bot.cjs bot=endless hero=all runs=6 time=300 turbo=4 lang=en
 *   node scripts/bot.cjs bot=expedition hero=kestra runs=1 time=1800 turbo=6 tier=2 shots=60
 *
 * Opcje bota (src/dev/bot.ts): bot, hero, runs, time, turbo, tier, god, fresh (nowy gracz bez odblokowań).
 * `lang` (en / pl) ustawia język gry, `shots=N` zapisuje zrzut co N sekund do /tmp/bot-shots, `limit` = limit w minutach.
 * Kod wyjścia 1, gdy były błędy albo brakujące tłumaczenia.
 */
const { chromium } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const url = args.url ?? 'http://localhost:5173/';
const lang = args.lang ?? 'en', shots = Number(args.shots ?? 0), limit = Number(args.limit ?? 30) * 60e3;
const q = new URLSearchParams(Object.entries(args).filter(([k]) => !['url', 'lang', 'shots', 'limit'].includes(k)));
if (!q.has('bot')) q.set('bot', 'endless');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.addInitScript((l) => localStorage.setItem('pixel-survivors-save', JSON.stringify({ version: 8, seenVersion: '9.9', settings: { hints: false, lang: l, music: 0, volume: 0 } })), lang);
  await p.goto(`${url}?${q}`);
  const t0 = Date.now();
  let lastShot = 0, rep = null;
  if (shots) require('fs').mkdirSync('/tmp/bot-shots', { recursive: true });
  while (Date.now() - t0 < limit) {
    await p.waitForTimeout(2000);
    rep = await p.evaluate(() => window.__bot ?? null);
    if (shots && Date.now() - lastShot > shots * 1000) {
      lastShot = Date.now();
      await p.screenshot({ path: `/tmp/bot-shots/${Math.round((lastShot - t0) / 1000)}.png` });
    }
    if ((!rep && Date.now() - t0 > 30e3) || rep?.done || errors.length) break;
  }
  rep = rep ?? { runs: [], errors: [], missing: [] };
  rep.errors = [...new Set([...rep.errors, ...errors])];
  rep.wallSeconds = Math.round((Date.now() - t0) / 1000);
  console.log(JSON.stringify(rep, null, 1));
  await b.close();
  process.exit(rep.errors.length || rep.missing.length ? 1 : 0);
})();
