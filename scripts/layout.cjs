/**
 * Test układu: przechodzi ekrany menu i gry (po angielsku i po polsku) i zgłasza napisy, które wychodzą poza ekran,
 * wystają poza swoje okno / kafelek / przycisk albo nachodzą na inny napis. Przechwytuje `fillText` i `roundRect`
 * (z przycinaniem przewijanych list), więc sprawdza to, co faktycznie widać. Na końcu wypisuje napisy bez tłumaczenia
 * (`trMisses` z core/i18n.ts) z odwiedzonych ekranów w obu językach.
 *
 *   npm run dev                      (w drugim terminalu)
 *   node scripts/layout.cjs                  (oba języki)
 *   node scripts/layout.cjs lang=pl only=menu   (only: menu | game)
 *   warianty: hints=1 (podpowiedzi włączone), small=1 (Text size Normal), wide=1 (ekran 20:9), touch=1 (sterowanie dotykiem), pad=1 (przyciski pada w napisach),
 *             hud=1.5 (rozmiar HUD-u; domyślnie 1; progi wystawania i rozmiaru ramek liczone w jednostkach skalowanego bloku)
 *
 * Zrzuty sprawdzanych ekranów: /tmp/layout-shots/<język>/. Podpowiedzi wyłączone (mają własne miejsca, HINT_BOX).
 * Celowe nakładanie nie jest zgłaszane: napis przemalowany na początku innego (np. czerwona nazwa modyfikatora mapy)
 * i plakietka poziomu „LV” na krawędzi portretu w HUD. Kod wyjścia 1, gdy coś wystaje, były błędy strony albo brak tłumaczeń.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const url = args.url ?? 'http://localhost:5173/';
const langs = args.lang ? [args.lang] : ['en', 'pl'];

/** Ekran z kodu: moduł z src/ui, klasa i dodatkowe argumenty konstruktora (`B` = menu główne jako ekran powrotu). */
const go = (mod, cls, extra = '') => ({ js: `(async()=>{const s=window.__screen();const M=await import('/src/ui/menus.ts');const X=await import('/src/ui/${mod}.ts');s.app.go(new X.${cls}(s.app${extra}));})()`, wait: 800 });
const B = ',new M.MainMenu(s.app)';
const R = 'const s=window.__screen(),r=s.run;';
const right = (prefix, n) => Array.from({ length: n }, (_, i) => ({ k: 'ArrowRight', w: 300, chk: `${prefix}${i + 2}` }));

const MENU = [
  { chk: 'main' }, { k: 'ArrowDown', w: 200, chk: 'main_endless' },
  go('menus', 'SlotScreen', ",'expedition'"), { chk: 'slot_expedition' },
  go('menus', 'SlotScreen', ",'endless'"), { chk: 'slot_endless' },
  go('menus', 'HeroSelect', ",'expedition'"), { chk: 'hero1' }, ...right('hero', 2),
  { k: 'ArrowDown ArrowDown ArrowDown ArrowDown ArrowDown ArrowDown', w: 150, chk: 'hero_last3' }, { k: 'ArrowLeft', w: 300, chk: 'hero_last2' },
  go('meta', 'MetaScreen', B), { chk: 'meta1' }, { k: 'KeyE', w: 300, chk: 'meta2' }, { k: 'KeyE KeyE KeyE KeyE KeyE', w: 200, chk: 'meta7' },
  go('collection', 'CollectionScreen', B), { chk: 'collection' }, { k: 'Tab', w: 400, chk: 'arsenal' },
  go('codex', 'CodexScreen', B), { chk: 'codex1' }, ...right('codex', 4),
  go('menus', 'RecordsScreen'), { chk: 'records' },
  go('help', 'HelpScreen', B), { chk: 'help1' }, ...right('help', 8),
  go('menus', 'SettingsScreen', B), { chk: 'settings1' }, ...Array.from({ length: 4 }, (_, i) => ({ k: 'Tab', w: 300, chk: `settings${i + 2}` })),
  go('controls', 'ControlsScreen', B), { chk: 'controls' },
  go('pacts', 'PactScreen', B), { chk: 'pacts' },
  go('whats-new', 'WhatsNewScreen'), { chk: 'whats_new' },
];

const GAME = [
  go('menus', 'HeroSelect', ",'expedition'"), { k: 'Enter', w: 1500, chk: 'map' }, { k: 'ArrowDown', w: 400, chk: 'map2' }, { k: 'Digit4', w: 400, chk: 'map_tier4' },
  { k: 'Enter', w: 3000, js: `(()=>{${R}r.player.hp=1e6;r.stats.maxHp=1e6;})()`, chk: 'play' },
  { k: 'F6', w: 900, chk: 'levelup' }, { k: 'Digit1', w: 500 },
  { js: `(()=>{${R}r.stats.choices=1;})()` }, { k: 'F6', w: 900, chk: 'levelup4' }, { k: 'Digit1', w: 500 },
  { k: 'F6', w: 500 }, { k: 'Digit1', w: 300 }, { k: 'F6', w: 500 }, { k: 'Digit1', w: 300 }, { k: 'F6', w: 500 }, { k: 'Digit1', w: 300 },
  { js: `(()=>{${R}r.pendingLoot.push(r.rollLoot('boss'));})()` }, { k: 'KeyD', w: 900, chk: 'loot' }, { k: 'Enter', w: 500 },
  { js: `(()=>{${R}for(let i=0;i<4;i++)r.pendingLoot.push(r.rollLoot('boss'));})()` }, { k: 'KeyD', w: 900, chk: 'loot2' },
  { k: 'ArrowDown', w: 150 }, { k: 'Enter', w: 500, chk: 'loot3' }, { k: 'ArrowDown', w: 150 }, { k: 'Enter', w: 500, chk: 'loot4' }, { k: 'Enter', w: 500 }, { k: 'Enter', w: 500 },
  // Seria łupu przy auto-ekwipunku: zwykłe i magiczne przedmioty od razu do plecaka, jeden komunikat (game-screen batchLoot).
  { js: `(()=>{${R}s.app.save.settings.autoEquip=true;for(let i=0;i<3;i++){const l=r.rollLoot('elite');l.item.rarity=1;delete l.item.super;delete l.item.unique;r.pendingLoot.push(l);}})()`, wait: 400, chk: 'loot_batch' },
  { js: `(()=>{${R}s.app.save.settings.autoEquip=false;})()` },
  { js: `(()=>{${R}r.pendingCards.push('boss');})()` }, { k: 'KeyD', w: 1200, chk: 'cards' }, { k: 'Digit1', w: 500 },
  { js: `(()=>{${R}r.pendingPowers++;})()` }, { k: 'KeyD', w: 1200, chk: 'power' }, { k: 'Digit1', w: 500 },
  { k: 'KeyI', w: 700, chk: 'inventory' }, { k: 'ArrowRight ArrowRight', w: 300, chk: 'inventory2' }, { k: 'Escape', w: 600 },
  { k: 'KeyC', w: 700, chk: 'build' }, { k: 'ArrowDown', w: 300, chk: 'build2' }, { k: 'Tab', w: 500, chk: 'build_elements' }, { k: 'Escape', w: 600 }, { k: 'Escape', w: 600 },
  { js: `(()=>{${R}s.openPause&&s.openPause();})()`, wait: 600, chk: 'pause1' }, { k: 'ArrowRight', w: 400, chk: 'pause2' }, { k: 'ArrowRight', w: 400, chk: 'pause3' },
  { k: 'ArrowDown ArrowDown ArrowDown', w: 200 }, { k: 'Enter', w: 700, chk: 'synergies' }, { k: 'Escape', w: 600 },
  { js: `(async()=>{${R}const m=await import('/src/data/shop.ts');r.gold=5000;r.shop=m.rollShop(r,r.depth);s.openShop('map');})()`, wait: 900, chk: 'shop' },
  { k: 'ArrowRight', w: 300, chk: 'shop2' }, { k: 'ArrowDown ArrowDown', w: 300, chk: 'shop3' },
  { js: `(()=>{${R}r.shop=null;s.state='play';s.openAnvil('play');})()`, wait: 900, chk: 'anvil' }, { k: 'Enter', w: 500, chk: 'anvil2' }, { k: 'Escape', w: 500 }, { k: 'KeyB', w: 500, chk: 'anvil_workshop' },
  { js: `(()=>{${R}s.state='play';r.player.hp=0;r.outcome='dead';r.outcomeT=0.2;r.killedBy={src:'Strażnik skarbca',dmg:1234,hits:12,recent:4321};r.takenBySource=new Map([['Strażnik skarbca',4321],['Shattered Knight',900],['Kultysta',500],['Bombardment',300],['Kolce',12]]);})()`, wait: 2500, chk: 'end1' }, ...right('end', 5),
];

const PATCH = () => {
  const P = CanvasRenderingContext2D.prototype;
  const st = { on: false, items: [], seq: 0 };
  window.__ov = st;
  // Skala z wysokości (270 logicznych), przesunięcie OX na szerokich ekranach: współrzędne interfejsu 0..480.
  const K = () => document.querySelector('canvas').height / 270;
  const OX = () => (document.querySelector('canvas').width / K() - 480) / 2;
  const box = (g, x, y, w, h) => { const t = g.getTransform(), k = K(); return [(t.a * x + t.e) / k - OX(), (t.d * y + t.f) / k, (t.a * w) / k, (t.d * h) / k]; };
  // Skala rysowania względem interfejsu (bloki HUD-u przy większym rozmiarze HUD-u): progi liczone w jednostkach bloku.
  const sc = (g) => g.getTransform().a / K();
  const oRR = P.roundRect;
  P.roundRect = function (x, y, w, h, r) { if (st.on && this.canvas.isConnected) { const b = box(this, x, y, w, h); if (w >= 12 && h >= 8) st.items.push({ k: 'r', b, i: st.seq++ }); } return oRR.call(this, x, y, w, h, r); };
  // Przycinanie (przewijane listy): ostatni prostokąt ścieżki + stos save/restore.
  let lastRect = null; const clipStack = []; let clipNow = null;
  const oRect = P.rect; P.rect = function (x, y, w, h) { if (this.canvas.isConnected) lastRect = box(this, x, y, w, h); return oRect.call(this, x, y, w, h); };
  const oSave = P.save; P.save = function () { if (this.canvas.isConnected) clipStack.push(clipNow); return oSave.call(this); };
  const oRes = P.restore; P.restore = function () { if (this.canvas.isConnected) clipNow = clipStack.pop() ?? null; return oRes.call(this); };
  const oClip = P.clip; P.clip = function (...a) { if (this.canvas.isConnected && lastRect) clipNow = lastRect; return oClip.apply(this, a); };
  const oFT = P.fillText;
  P.fillText = function (s, x, y) {
    if (st.on && this.canvas.isConnected && s.trim()) {
      const m = this.measureText(s);
      const b = box(this, x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent, m.actualBoundingBoxLeft + m.actualBoundingBoxRight, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
      let bb = b;
      if (clipNow) {
        const [cx, cy, cw, ch] = clipNow, x0 = Math.max(b[0], cx), y0 = Math.max(b[1], cy), x1 = Math.min(b[0] + b[2], cx + cw), y1 = Math.min(b[1] + b[3], cy + ch);
        if (x1 - x0 < 1 || y1 - y0 < 1) return oFT.call(this, s, x, y);
        bb = [x0, y0, x1 - x0, y1 - y0];
      }
      st.items.push({ k: 't', s, b: bb, i: st.seq++, col: String(this.fillStyle), sc: sc(this) });
    }
    return oFT.call(this, s, x, y);
  };
};

async function run(lang, name, steps, report, errs, misses) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: args.wide ? 1800 : 1440, height: 810 } });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.addInitScript(PATCH);
  await p.goto(url);
  await p.evaluate(async ({ lang, ...a }) => {
    const u = await import('/src/data/unlocks.ts');
    localStorage.setItem('pixel-survivors-save', JSON.stringify({
      version: 10, unlocks: [...u.ALL_UNLOCKS], tutorialDone: true, seenVersion: '9.9.9',
      settings: { flashWarned: true, debug: true, lang, volume: 0, music: 0, textLarge: !a.small, hints: !!a.hints, autoEquip: false, hudScale: +(a.hud ?? 1) }, // bez auto-ekwipunku: zwykły łup otwiera okna (kroki loot*)
    }));
  }, { lang, ...args });
  await p.reload(); await p.waitForTimeout(1500);
  const tag = ['hints', 'small', 'wide', 'touch', 'pad', 'hud'].filter((k) => args[k]).join('-'), dir = `/tmp/layout-shots/${tag ? tag + '-' : ''}${lang}`, ox = args.wide ? (1800 / 3 - 480) / 2 : 0;
  fs.mkdirSync(dir, { recursive: true });
  for (const st of steps) {
    if (st.k) for (const key of st.k.split(' ')) { await p.keyboard.press(key, { delay: 50 }); await p.waitForTimeout(st.w ?? 250); }
    if (st.js) await p.evaluate(st.js);
    if (st.wait) await p.waitForTimeout(st.wait);
    if (!st.chk) continue;
    if (args.touch) await p.evaluate(() => { const i = window.__screen().app.input; i.lastDevice = 'touch'; i.touchControls = true; });
    if (args.pad) await p.evaluate(() => { window.__screen().app.input.lastDevice = 'pad'; });
    const items = await p.evaluate(() => new Promise((res) => requestAnimationFrame(() => { const o = window.__ov; o.items = []; o.seq = 0; o.on = true; requestAnimationFrame(() => { o.on = false; res(o.items); }); })));
    await p.screenshot({ path: `${dir}/${name}_${st.chk}.png` });
      const texts = items.filter((x) => x.k === 't'), rects = items.filter((x) => x.k === 'r');
      const issues = [];
      const E = 0.6;
      // unikalne napisy (cień/obrys = ten sam napis przesunięty)
      const uniq = [];
      for (const t of texts) if (!uniq.some((u) => u.s === t.s && Math.abs(u.b[0] - t.b[0]) < 1.5 && Math.abs(u.b[1] - t.b[1]) < 1.5)) uniq.push(t);
      for (const t of uniq) {
        const [x, y, w, h] = t.b;
        if (x < -ox - E || y < -E || x + w > 480 + ox + E || y + h > 270 + E) issues.push(`OFFSCREEN "${t.s}" @${x.toFixed(0)},${y.toFixed(0)} w${w.toFixed(0)}`);
        // najmniejszy wcześniejszy prostokąt zawierający środek napisu
        const mx = x + w / 2, my = y + h / 2;
        const cont = rects.filter((r) => r.i < t.i && mx >= r.b[0] && my >= r.b[1] && mx < r.b[0] + r.b[2] && my < r.b[1] + r.b[3] && r.b[2] * r.b[3] < 480 * 270 * 0.9)
          .sort((a, c) => a.b[2] * a.b[3] - c.b[2] * c.b[3])[0];
        if (cont) {
          const [rx, ry, rw, rh] = cont.b;
          const L = rx - x, R = x + w - (rx + rw), T = ry - y, Bo = y + h - (ry + rh);
          // Tolerancja w jednostkach bloku: wystawanie o ułamek piksela w skali 1 zostaje ułamkiem po powiększeniu HUD-u.
          const parts = [['L', L], ['R', R], ['T', T], ['B', Bo]].filter(([, v]) => v > E * Math.max(1, t.sc ?? 1)).map(([k, v]) => k + v.toFixed(1));
          if (parts.length) issues.push(`SPILL "${t.s}" ${parts.join(' ')} box@${cont.b.map((v) => v.toFixed(0)).join(',')}`);
        }
      }
      for (let a = 0; a < uniq.length; a++) for (let c = a + 1; c < uniq.length; c++) {
        const A = uniq[a].b, B = uniq[c].b;
        if (uniq[a].s === uniq[c].s) continue;
        const ix = Math.min(A[0] + A[2], B[0] + B[2]) - Math.max(A[0], B[0]), iy = Math.min(A[1] + A[3], B[1] + B[3]) - Math.max(A[1], B[1]);
        if (ix > 1 && iy > 1.5) issues.push(`OVERLAP "${uniq[a].s}" x "${uniq[c].s}" (${ix.toFixed(1)}x${iy.toFixed(1)})`);
      }
      report.push({ lang, shot: `${name}_${st.chk}`, n: uniq.length, issues: issues.filter(allowed) });
  }
  // Napisy bez tłumaczenia (core/i18n.ts zbiera je na serwerze deweloperskim): ten sam moduł co w grze.
  for (const m of await p.evaluate(async () => [...(await import('/src/core/i18n.ts')).trMisses])) misses.add(m);
  await b.close();
}

/** Celowe: napis przemalowany na początku dłuższego (nazwa modyfikatora), plakietka „LV” na krawędzi portretu, plakietki pod podpowiedzią. */
function allowed(issue) {
  const m = issue.match(/^OVERLAP "(.*)" x "(.*)" \(/);
  if (m && (m[1].startsWith(m[2]) || m[2].startsWith(m[1]))) return false;
  if (/^SPILL "LV \d+"/.test(issue)) return false;
  // Jednoznakowe plakietki węzłów mapy („+” bonusu) pod ramką podpowiedzi (hints=1): podpowiedź celowo leży na dalekich węzłach.
  if (m && (m[1].length === 1 || m[2].length === 1)) return false;
  return true;
}

(async () => {
  const report = [], errs = [], misses = new Set();
  for (const lang of langs) {
    if (args.only !== 'game') await run(lang, 'menu', MENU, report, errs, misses);
    if (args.only !== 'menu') await run(lang, 'game', GAME, report, errs, misses);
  }
  let bad = 0;
  for (const r of report) {
    if (!r.issues.length) continue;
    bad += r.issues.length;
    console.log(`== [${r.lang}] ${r.shot} (${r.n} napisów)`);
    for (const i of r.issues.slice(0, 20)) console.log('   ' + i);
  }
  console.log(`Ekrany: ${report.length}, problemy: ${bad}, błędy strony: ${errs.length}, bez tłumaczenia: ${misses.size}`);
  for (const e of errs) console.log('   ' + e);
  for (const m of misses) console.log('   brak tłumaczenia ' + m);
  process.exit(bad || errs.length || misses.size ? 1 : 0);
})();
