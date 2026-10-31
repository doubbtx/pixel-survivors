/**
 * Materiały do sklepu (Steam, Google Play, itch.io) z działającej gry: zrzuty 1920×1080, kapsuły Steam i okładka itch.io (630×500) z logo
 * i nagranie rozgrywki (webm, materiał na zwiastun). Wynik w katalogu `out=` (domyślnie /tmp/store), poza repozytorium.
 *
 *   npm run dev            (w drugim terminalu)
 *   node scripts/store.cjs [out=/tmp/store] [lang=en] [video=20]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const url = args.url ?? 'http://localhost:5173/';
const out = args.out ?? '/tmp/store', lang = args.lang ?? 'en', videoSec = Number(args.video ?? 20);
const VIEW = { width: 1920, height: 1080 };

/** Zapis z pełnymi odblokowaniami, bez podpowiedzi i dźwięku (czyste kadry). */
const SAVE = (u) => JSON.stringify({ version: 10, unlocks: u, tutorialDone: true, seenVersion: '9.9.9', settings: { flashWarned: true, lang: '__LANG__', volume: 0, music: 0, hints: false, textLarge: true } });

async function page(b, opts = {}) {
  const p = await b.newPage({ viewport: VIEW, ...opts });
  await p.goto(url);
  await p.waitForTimeout(1200);
  const save = await p.evaluate(async () => [...(await import('/src/data/unlocks.ts')).ALL_UNLOCKS]);
  await p.evaluate((s) => localStorage.setItem('pixel-survivors-save', s), SAVE(save).replace('__LANG__', lang));
  await p.reload();
  await p.waitForTimeout(1800);
  return p;
}

const go = (p, mod, cls, extra = '') => p.evaluate(`(async()=>{const s=window.__screen();const M=await import('/src/ui/menus.ts');const X=await import('/src/ui/${mod}.ts');s.app.go(new X.${cls}(s.app${extra}));})()`);
const run = (p, js) => p.evaluate(`(async()=>{const s=window.__screen(),r=s.run;${js}})()`);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await page(b);
  const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: path.join(out, `${name}.png`) }); console.log(name); };

  // Menu i wybór bohatera.
  await shot('01-menu');
  await go(p, 'menus', 'HeroSelect', ",'expedition'");
  await p.waitForTimeout(600);
  await shot('02-heroes');
  // Mapa wyprawy, potem walka w każdym biomie z tłumem i bossem.
  await p.keyboard.press('Enter', { delay: 50 });
  await p.waitForTimeout(1500);
  await shot('03-map');
  await p.keyboard.press('Enter', { delay: 50 });
  await p.waitForTimeout(3000);
  for (let bi = 0; bi < 4; bi++) {
    // Tłum walczący wręcz (strzelcy zasypują kadr pociskami), boss biomu; pociski czyszczone tuż przed zrzutem.
    await run(p, `r.player.hp=1e6;r.stats.maxHp=1e6;r.xp=0;r.xpNext=1e12;const L=await import('/src/data/levels.ts');r.levelInfo={...r.levelInfo,biome:${bi},bossName:L.BIOMES[${bi}].bossName};r.enemies.clear();r.bullets.clear();
      const sp=await import('/src/systems/spawner.ts'),ids=['slime','bat','golem','boar','toad','shieldbearer','lurker','salamander','stag','thornling'];
      for(let i=0;i<45;i++){const a=i*0.7,d=70+(i%5)*24;sp.spawnEnemy(r,ids[(i+${bi}*3)%ids.length],r.player.x+Math.cos(a)*d,r.player.y+Math.sin(a)*d*0.7);}
      const b=sp.spawnEnemy(r,'boss',r.player.x+80,r.player.y-40);if(b)b.sprite='boss${bi}';`);
    await p.mouse.move(1450, 330);
    await p.waitForTimeout(1500);
    await run(p, 'r.bullets.clear();');
    await p.waitForTimeout(120);
    await shot(`0${4 + bi}-fight-biome${bi}`);
  }
  // Awans: karty wyboru.
  await run(p, 'r.xpNext=10;');
  await p.keyboard.press('F6', { delay: 50 });
  await p.waitForTimeout(900);
  await shot('08-levelup');

  // Kapsuły Steam: samo tło menu (niebo, zamek, defilada, bez paneli) z logo; rozmiary z wytycznych Steamworks.
  await p.keyboard.press('Digit1', { delay: 50 });
  await p.evaluate(`(async()=>{const s=window.__screen(),M=await import('/src/ui/menus.ts');let t=3;s.app.go({update(dt){t+=dt;},render(){M.menuBackdrop(s.app,t);}});})()`);
  await p.waitForTimeout(1500);
  const menu = await p.screenshot();
  for (const [name, w, h] of [['capsule-main', 1232, 706], ['capsule-header', 920, 430], ['capsule-small', 462, 174], ['capsule-library', 600, 900], ['itch-cover', 630, 500]]) {
    const data = await p.evaluate(async ({ img, w, h }) => {
      const im = new Image();
      im.src = `data:image/png;base64,${img}`;
      await im.decode();
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      // Tło: dolna część menu (niebo, zamek, łąka z defiladą) przycięta do proporcji kapsuły.
      const sh = Math.min(im.height, (im.width * h) / w), sw = (sh * w) / h;
      g.drawImage(im, (im.width - sw) / 2, im.height - sh, sw, sh, 0, 0, w, h);
      g.fillStyle = 'rgba(24,20,37,0.35)';
      g.fillRect(0, 0, w, h);
      // Logo: gradient złoto → pomarańcz z ciemnym obrysem i cieniem.
      const fs = Math.round(Math.min(w / 7.5, h / 3.2));
      g.font = `${fs}px "Jersey 10", monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const lines = w / h < 1 ? ['Pixel', 'Survivors'] : ['Pixel Survivors'];
      lines.forEach((t, i) => {
        const y = h * (lines.length > 1 ? 0.22 + i * 0.13 : 0.32);
        g.lineWidth = fs * 0.12;
        g.strokeStyle = '#181425';
        g.fillStyle = '#a22633';
        g.fillText(t, w / 2 + fs * 0.05, y + fs * 0.06);
        g.strokeText(t, w / 2, y);
        const grad = g.createLinearGradient(0, y - fs / 2, 0, y + fs / 2);
        grad.addColorStop(0, '#fee761');
        grad.addColorStop(0.5, '#feae34');
        grad.addColorStop(1, '#f77622');
        g.fillStyle = grad;
        g.fillText(t, w / 2, y);
      });
      return c.toDataURL('image/png');
    }, { img: menu.toString('base64'), w, h });
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
    console.log(name, w, h);
  }
  await p.close();

  // Nagranie: bot gra Endless (turbo 1), webm z Playwrighta.
  if (videoSec > 0) {
    const v = await b.newPage({ viewport: VIEW, recordVideo: { dir: out, size: VIEW } });
    await v.addInitScript((l) => localStorage.setItem('pixel-survivors-save', JSON.stringify({ version: 10, tutorialDone: true, seenVersion: '9.9.9', settings: { flashWarned: true, hints: false, lang: l, music: 0, volume: 0 } })), lang);
    await v.goto(`${url}?bot=endless&hero=kestra&runs=1&time=600&turbo=1&god=1`);
    await v.waitForTimeout(videoSec * 1000);
    const file = await v.video().path();
    await v.close();
    fs.renameSync(file, path.join(out, 'gameplay.webm'));
    console.log('gameplay.webm');
  }
  await b.close();
})();
