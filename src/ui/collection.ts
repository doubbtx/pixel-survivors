import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { CARDS, type CardDef } from '../data/cards';
import { HERO_BY_ID } from '../data/heroes';
import type { App, Screen } from './app';
import { drawCard, rarityColor } from './cards';
import { button, panel, slot, inside } from './widgets';
import { UNIQUES, UNIQUE_COLOR, BASE_BY_ID, rollUnique, type Item } from '../data/items';
import { drawItemCard } from './items';
import { SECRETS } from '../data/secrets';
import { BESTIARY, loreBonus } from '../data/bestiary';
import { ENEMIES } from '../data/enemies';
import { ACHIEVEMENTS } from '../data/achievements';
import { FEATS } from '../data/feats';
import { CARD_BY_ID } from '../data/cards';
import { fmt } from '../util/format';
import { WEAPONS, WEAPON_BY_ID, FUSIONS, maxLevel } from '../data/weapons';
import { PASSIVES, PASSIVE_BY_ID } from '../data/passives';
import { AUGMENTS, fusionAugments, FUSION_RULES } from '../data/augments';
import { ELEMENTS, WEAPON_ELEMENT } from '../data/elements';

const COLS = 15, TILE = 17, STEP = 18;
const GRID_X = 12, GRID_Y = 50;
const CARD_X = 300, CARD_Y = 40;
const RARITY_ORDER = { silver: 0, gold: 1, prism: 2 } as const;

/** Unikaty: siatka i przykładowe egzemplarze (poziom 1) do karty przedmiotu. */
const U_COLS = 5, U_TILE = 28, U_STEP = 32, U_X = 24, U_Y = 56;
const U_SAMPLES: Item[] = UNIQUES.map((u) => rollUnique(1, u.id));

/** Zakładki w kolejności przełączania (Tab), nazwy i kolory nagłówków. */
type Tab = 'cards' | 'arsenal' | 'uniques' | 'secrets' | 'bestiary' | 'achievements' | 'feats';
const TABS: Tab[] = ['cards', 'arsenal', 'uniques', 'secrets', 'bestiary', 'achievements', 'feats'];
const TAB_NAME: Record<Tab, string> = { cards: 'Karty', arsenal: 'Arsenał', uniques: 'Unikaty', secrets: 'Sekrety', bestiary: 'Bestiariusz', achievements: 'Osiągnięcia', feats: 'Wyczyny' };

/** Arsenał: bronie bazowe i pasywki (siatka 7 kolumn, dwie grupy). */
const ARS_WEAPONS = WEAPONS.filter((w) => !w.evolved);
const A_COLS = 7, A_TILE = 24, A_STEP = 28, A_X = 16, A_WY = 50, A_PY = 50 + 2 * A_STEP + 22;
const ARS_N = ARS_WEAPONS.length + PASSIVES.length;
const SMALL = { scale: 0.75 } as const;
const arsPos = (i: number): [number, number] => {
  const p = i >= ARS_WEAPONS.length, k = p ? i - ARS_WEAPONS.length : i;
  return [A_X + (k % A_COLS) * A_STEP, (p ? A_PY : A_WY) + Math.floor(k / A_COLS) * A_STEP];
};

/** Bestiariusz: siatka 6 kolumn. */
const B_COLS = 6, B_TILE = 28, B_STEP = 32, B_X = 18, B_Y = 50;

/** Karty w kolejności: rzadkość, potem karty ogólne przed kartami bohaterów. */
const ORDERED: CardDef[] = [...CARDS].sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || Number(!!a.hero) - Number(!!b.hero));

/**
 * Kolekcja kart (z menu głównego): wszystkie karty, odkryte (widziane w ofercie) i nieodkryte,
 * liczba wyborów oraz bany — zbanowana karta nie pojawia się w żadnej ofercie (limit BAL.cardBanSlots).
 * Strzałki / mysz: wybór, B / klik w przycisk: ban, Esc: wróć. Tab: zakładka Unikaty (odkryte unikaty z opisem efektu).
 */
export class CollectionScreen implements Screen {
  private sel = 0;
  private tab: Tab = 'cards';
  private sSel = 0;
  private bSel = 0;
  private aSel = 0;
  private uSel = 0;
  private wSel = 0;
  private step = 0;
  private lastMouse = 0;
  private note = '';
  private noteT = 0;

  constructor(private readonly app: App, private readonly back: Screen) {}

  private get col() {
    return this.app.save.collection;
  }

  private tilePos(i: number): [number, number] {
    return [GRID_X + (i % COLS) * STEP, GRID_Y + Math.floor(i / COLS) * STEP];
  }

  private toggleBan(c: CardDef): void {
    const col = this.col;
    const i = col.banned.indexOf(c.id);
    if (i >= 0) col.banned.splice(i, 1);
    else if (!col.seen.includes(c.id)) { this.say('Najpierw odkryj tę kartę w grze'); return; }
    else if (col.banned.length >= BAL.cardBanSlots) { this.say(`Limit banów: ${BAL.cardBanSlots}`); return; }
    else col.banned.push(c.id);
    this.app.persist();
    sfx.play('select');
  }

  private say(s: string): void {
    this.note = s;
    this.noteT = 2;
    sfx.play('hurt');
  }

  update(dt: number): void {
    this.step++;
    this.noteT = Math.max(0, this.noteT - dt);
    const inp = this.app.input, n = ORDERED.length;
    if (inp.pressed('back')) { this.app.go(this.back); return; }
    if (inp.pressed('inventory') || (inp.pressed('click') && inside(inp.mouse.x, inp.mouse.y, W - 116, 8, 108, 18))) {
      this.tab = TABS[(TABS.indexOf(this.tab) + 1) % TABS.length];
      sfx.play('select');
      return;
    }
    if (this.tab === 'uniques') { this.updateUniques(); return; }
    if (this.tab === 'arsenal') { this.updateArsenal(); return; }
    if (this.tab === 'secrets') { this.updateSecrets(); return; }
    if (this.tab === 'bestiary') { this.updateBestiary(); return; }
    if (this.tab === 'achievements') { this.updateAchievements(); return; }
    if (this.tab === 'feats') { if (inp.pressed('click') && inside(inp.mouse.x, inp.mouse.y, 8, 8, 70, 18)) this.app.go(this.back); return; }
    if (inp.pressed('left')) this.sel = (this.sel + n - 1) % n;
    if (inp.pressed('right')) this.sel = (this.sel + 1) % n;
    if (inp.pressed('up')) this.sel = (this.sel + n - COLS) % n;
    if (inp.pressed('down')) this.sel = (this.sel + COLS) % n;
    if (inp.pressed('banish') || inp.pressed('confirm')) this.toggleBan(ORDERED[this.sel]);
    const m = inp.mouse;
    for (let i = 0; i < n; i++) {
      const [x, y] = this.tilePos(i);
      if (!inside(m.x, m.y, x, y, TILE, TILE)) continue;
      if (m.lastMove !== this.lastMouse) this.sel = i;
      if (inp.pressed('click')) this.sel = i;
    }
    if (inp.pressed('click') && inside(m.x, m.y, CARD_X + 18, 214, 100, 16)) this.toggleBan(ORDERED[this.sel]);
    if (inp.pressed('click') && inside(m.x, m.y, 8, 8, 70, 18)) this.app.go(this.back);
    this.lastMouse = m.lastMove;
  }

  private updateUniques(): void {
    const inp = this.app.input, n = UNIQUES.length;
    if (inp.pressed('left')) this.uSel = (this.uSel + n - 1) % n;
    if (inp.pressed('right')) this.uSel = (this.uSel + 1) % n;
    if (inp.pressed('up')) this.uSel = (this.uSel + n - U_COLS) % n;
    if (inp.pressed('down')) this.uSel = (this.uSel + U_COLS) % n;
    const m = inp.mouse;
    UNIQUES.forEach((_, i) => {
      const x = U_X + (i % U_COLS) * U_STEP, y = U_Y + Math.floor(i / U_COLS) * U_STEP;
      if (inside(m.x, m.y, x, y, U_TILE, U_TILE) && (m.lastMove !== this.lastMouse || inp.pressed('click'))) this.uSel = i;
    });
    if (inp.pressed('click') && inside(m.x, m.y, 8, 8, 70, 18)) this.app.go(this.back);
    this.lastMouse = m.lastMove;
  }

  private updateArsenal(): void {
    const inp = this.app.input, n = ARS_N;
    if (inp.pressed('left')) this.wSel = (this.wSel + n - 1) % n;
    if (inp.pressed('right')) this.wSel = (this.wSel + 1) % n;
    if (inp.pressed('up')) this.wSel = (this.wSel + n - A_COLS) % n;
    if (inp.pressed('down')) this.wSel = (this.wSel + A_COLS) % n;
    const m = inp.mouse;
    for (let i = 0; i < n; i++) {
      const [x, y] = arsPos(i);
      if (inside(m.x, m.y, x, y, A_TILE, A_TILE) && (m.lastMove !== this.lastMouse || inp.pressed('click'))) this.wSel = i;
    }
    if (inp.pressed('click') && inside(m.x, m.y, 8, 8, 70, 18)) this.app.go(this.back);
    this.lastMouse = m.lastMove;
  }

  /**
   * Zakładka Arsenał: wszystkie bronie bazowe i pasywki. Broń: opis, żywioł, ewolucja (broń + pasywka), fuzje i augmenty;
   * pasywka: opis na poziom i bronie, które ewoluuje.
   */
  private renderArsenal(): void {
    const r = this.app.r, g = r.g;
    panel(r, 6, 32, 214, 196, C.slate);
    drawText(g, 'Bronie', A_X, 38, C.lavender);
    drawText(g, 'Pasywki', A_X, A_PY - 12, C.lavender);
    for (let i = 0; i < ARS_N; i++) {
      const [x, y] = arsPos(i), w = ARS_WEAPONS[i], p = PASSIVES[i - ARS_WEAPONS.length];
      slot(r, x, y, A_TILE, w ? (w.hero ? HERO_BY_ID[w.hero].color : C.blue) : C.lime);
      drawSprite(g, w ? w.icon : p.icon, x + A_TILE / 2, y + A_TILE / 2);
      if (i === this.wSel) r.frame(x - 2, y - 2, A_TILE + 4, A_TILE + 4, C.white);
    }
    const X = 228, PW = W - X - 6, TW = (PW - 20) / SMALL.scale;
    panel(r, X, 32, PW, 212, C.gold);
    let y = 40;
    const head = (s: string, col: number = C.lavender) => { y += 3; drawText(g, s, X + 10, y, col); y += 11; };
    const text = (s: string, col: number = C.lgray) => { for (const l of wrapText(s, TW)) { if (y > 236) return; drawText(g, l, X + 10, y, col, SMALL); y += 8.5; } };
    const w = ARS_WEAPONS[this.wSel];
    if (w) {
      drawSprite(g, w.icon, X + 20, y + 10, { scale: 2 });
      drawText(g, w.name, X + 40, y + 1, w.color, { shadow: C.black });
      const el = WEAPON_ELEMENT[w.id];
      drawText(g, `${w.hero ? `tylko ${HERO_BY_ID[w.hero].name}, ` : ''}poz. maks. ${maxLevel(w)}${el ? `, ${ELEMENTS[el].name.toLowerCase()}` : ''}`, X + 40, y + 12, C.dgray);
      y += 26;
      text(el ? `${w.desc} Żywioł: ${ELEMENTS[el].name} (${ELEMENTS[el].desc}).` : w.desc, C.white);
      if (w.evolve) {
        const ev = WEAPON_BY_ID[w.evolve.into], pa = PASSIVE_BY_ID[w.evolve.passive];
        head(`Ewolucja: ${ev.name}`, C.yellow);
        text(`Broń na poz. ${maxLevel(w)} + pasywka ${pa.name}, potem awans. ${ev.desc}`);
      }
      const fus = FUSIONS.filter((f) => f.a === w.id || f.b === w.id);
      if (fus.length) {
        head('Fuzje (obie bronie na maks. albo po ewolucji)', C.pink);
        text(FUSION_RULES, C.dgray);
        for (const f of fus) {
          const into = WEAPON_BY_ID[f.into], { kept, lost } = fusionAugments(into);
          text(`+ ${WEAPON_BY_ID[f.a === w.id ? f.b : f.a].name}: ${into.name}. ${into.desc}`);
          if (kept.length) text(`Zostają augmenty: ${kept.map((a) => a.name).join(', ')}.`, C.cyan);
          if (lost.length) text(`Przepadają: ${lost.map((a) => a.name).join(', ')}.`, C.salmon);
        }
      }
      const augs = AUGMENTS.filter((a) => a.weapon === w.id);
      if (augs.length) {
        head(`Augmenty (od poz. ${BAL.augmentMinLevel})`, C.cyan);
        for (const a of augs) text(`${a.name}: ${a.desc}${a.elem ? ` Żywioł: ${ELEMENTS[a.elem].name}.` : ''}`);
      }
      return;
    }
    const p = PASSIVES[this.wSel - ARS_WEAPONS.length];
    drawSprite(g, p.icon, X + 20, y + 10, { scale: 2 });
    drawText(g, p.name, X + 40, y + 1, C.lime, { shadow: C.black });
    drawText(g, `Pasywka, poz. maks. ${p.maxLevel}`, X + 40, y + 12, C.dgray);
    y += 26;
    text(`${p.desc} na każdy poziom.`, C.white);
    const evo = WEAPONS.filter((x) => x.evolve?.passive === p.id);
    if (evo.length) {
      head('Ewoluuje bronie', C.yellow);
      for (const x of evo) text(`${x.name} > ${WEAPON_BY_ID[x.evolve!.into].name}`);
    }
  }

  private updateSecrets(): void {
    const inp = this.app.input, n = SECRETS.length;
    if (inp.pressed('up')) this.sSel = (this.sSel + n - 1) % n;
    if (inp.pressed('down')) this.sSel = (this.sSel + 1) % n;
    const m = inp.mouse;
    SECRETS.forEach((_, i) => {
      if (inside(m.x, m.y, 10, 40 + i * 14, 200, 13) && (m.lastMove !== this.lastMouse || inp.pressed('click'))) this.sSel = i;
    });
    if (inp.pressed('click') && inside(m.x, m.y, 8, 8, 70, 18)) this.app.go(this.back);
    this.lastMouse = m.lastMove;
  }

  private updateBestiary(): void {
    const inp = this.app.input, n = BESTIARY.length;
    if (inp.pressed('left')) this.bSel = (this.bSel + n - 1) % n;
    if (inp.pressed('right')) this.bSel = (this.bSel + 1) % n;
    if (inp.pressed('up')) this.bSel = (this.bSel + n - B_COLS) % n;
    if (inp.pressed('down')) this.bSel = (this.bSel + B_COLS) % n;
    const m = inp.mouse;
    BESTIARY.forEach((_, i) => {
      const x = B_X + (i % B_COLS) * B_STEP, y = B_Y + Math.floor(i / B_COLS) * B_STEP;
      if (inside(m.x, m.y, x, y, B_TILE, B_TILE) && (m.lastMove !== this.lastMouse || inp.pressed('click'))) this.bSel = i;
    });
    if (inp.pressed('click') && inside(m.x, m.y, 8, 8, 70, 18)) this.app.go(this.back);
    this.lastMouse = m.lastMove;
  }

  private updateAchievements(): void {
    const inp = this.app.input, n = ACHIEVEMENTS.length;
    if (inp.pressed('up')) this.aSel = (this.aSel + n - 1) % n;
    if (inp.pressed('down')) this.aSel = (this.aSel + 1) % n;
    const m = inp.mouse;
    ACHIEVEMENTS.forEach((_, i) => {
      if (inside(m.x, m.y, 10, 36 + i * 13, 220, 12) && (m.lastMove !== this.lastMouse || inp.pressed('click'))) this.aSel = i;
    });
    if (inp.pressed('click') && inside(m.x, m.y, 8, 8, 70, 18)) this.app.go(this.back);
    this.lastMouse = m.lastMove;
  }

  /** Zakładka Bestiariusz: siatka wrogów (nieznani jako sylwetka), zabójstwa, opis po progu `know` i bonusy progów. */
  private renderBestiary(): void {
    const r = this.app.r, g = r.g, kills = this.app.save.bestiary;
    panel(r, 6, 32, 204, 196, C.slate);
    drawText(g, `Poznani wrogowie ${BESTIARY.filter((b) => (kills[b.id] ?? 0) >= b.know).length}/${BESTIARY.length}`, B_X, 37, C.lavender);
    BESTIARY.forEach((b, i) => {
      const x = B_X + (i % B_COLS) * B_STEP, y = B_Y + Math.floor(i / B_COLS) * B_STEP, n = kills[b.id] ?? 0;
      slot(r, x, y, B_TILE, loreBonus(b, n) > 0 ? C.gold : n >= b.know ? C.lavender : C.slate);
      if (n > 0) drawSprite(g, `${b.sprite}@0`, x + B_TILE / 2, y + B_TILE / 2, { scale: b.id === 'boss' ? 0.6 : 1, flash: n < b.know });
      else drawText(g, '?', x + B_TILE / 2, y + 9, C.dgray, { align: 'center' });
      if (i === this.bSel) r.frame(x - 2, y - 2, B_TILE + 4, B_TILE + 4, C.white);
    });
    const b = BESTIARY[this.bSel], n = kills[b.id] ?? 0, known = n >= b.know;
    panel(r, 218, 40, W - 228, 186, known ? C.lavender : C.slate);
    drawText(g, n > 0 ? (b.id === 'boss' ? 'Bossowie' : ENEMIES[b.id].name) : '???', 228, 48, known ? C.white : C.dgray, { scale: 2 });
    drawText(g, `Zabitych: ${fmt(n)}`, 228, 70, C.lgray);
    let y = 86;
    if (known) for (const l of wrapText(b.lore, W - 248)) { drawText(g, l, 228, y, C.white); y += 11; }
    else drawText(g, `Zabij ${b.know}, żeby poznać opis.`, 228, y, C.dgray);
    y = 150;
    for (const [lbl, need, v] of [['Mistrz', b.master, BAL.bestiary.master], ['Legenda', b.legend, BAL.bestiary.legend]] as const) {
      const ok = n >= need;
      drawText(g, `${lbl}: ${fmt(need)} zabójstw`, 228, y, ok ? C.gold : C.dgray);
      drawText(g, `+${Math.round(v * 100)}% obrażeń przeciw ${b.id === 'boss' ? 'bossom' : 'temu wrogowi'}`, 238, y + 11, ok ? C.yellow : C.dgray);
      y += 26;
    }
  }

  /** Zakładka Osiągnięcia: lista (zdobyte zielone) i szczegóły: warunek oraz karta-nagroda. */
  private renderAchievements(): void {
    const r = this.app.r, g = r.g, got = this.app.save.achievements;
    ACHIEVEMENTS.forEach((a, i) => {
      const y = 36 + i * 13, ok = got.includes(a.id), on = i === this.aSel;
      panel(r, 10, y, 220, 12, on ? C.lime : C.slate);
      drawText(g, a.name, 18, y, ok ? C.lime : C.lgray);
      drawText(g, ok ? 'zdobyte' : '', 224, y, C.lime, { align: 'right' });
    });
    const a = ACHIEVEMENTS[this.aSel], ok = got.includes(a.id);
    wrapText(a.desc, W - 250).forEach((l, i) => drawText(g, l, 240, 34 + i * 10, ok ? C.lime : C.white));
    drawText(g, ok ? 'Nagroda odblokowana: karta w ofertach' : 'Nagroda: nowa karta w ofertach', 240, 58, ok ? C.lime : C.lavender);
    drawCard(r, CARD_BY_ID[a.card], 290, 72, false, this.step, 0);
    drawText(g, `Zdobyte ${ACHIEVEMENTS.filter((x) => got.includes(x.id)).length}/${ACHIEVEMENTS.length}`, 10, 36 + ACHIEVEMENTS.length * 13 + 2, C.lavender);
  }

  /** Zakładka Wyczyny: warunek, nagroda i ile razy zdobyty. */
  private renderFeats(): void {
    const r = this.app.r, g = r.g, got = this.app.save.feats;
    FEATS.forEach((f, i) => {
      const y = 32 + i * 20, n = got[f.id] ?? 0;
      panel(r, 10, y, W - 20, 19, n ? C.gold : C.slate);
      drawText(g, f.name, 16, y, n ? C.gold : C.lgray);
      drawText(g, n ? `zdobyty ${n}x` : 'jeszcze nie', W - 16, y, n ? C.yellow : C.dgray, { align: 'right' });
      drawText(g, f.desc, 112, y, C.white);
      drawText(g, `Nagroda: ${f.reward}`, 112, y + 9, C.lavender);
    });
  }

  /** Zakładka Sekrety: lista (nieodkryte wyszarzone) i szczegóły: zagadka, warunek wprost i efekt. */
  private renderSecrets(): void {
    const r = this.app.r, g = r.g, found = this.col.secrets;
    SECRETS.forEach((s, i) => {
      const y = 40 + i * 14, known = found.includes(s.id), on = i === this.sSel;
      panel(r, 10, y, 200, 13, on ? C.hotpink : C.slate);
      drawText(g, s.name, 18, y + 1, known ? C.white : C.dgray);
      if (s.hero) drawText(g, HERO_BY_ID[s.hero].name, 204, y + 1, HERO_BY_ID[s.hero].color, { align: 'right' });
    });
    const s = SECRETS[this.sSel], known = found.includes(s.id);
    panel(r, 220, 40, W - 230, 186, known ? C.hotpink : C.slate);
    drawText(g, s.name, 230, 48, known ? C.hotpink : C.dgray, { scale: 2 });
    if (!known) drawText(g, 'jeszcze nieodkryty', W - 18, 52, C.dgray, { align: 'right' });
    let y = 76;
    drawText(g, 'Zagadka:', 230, y, C.lavender); y += 12;
    for (const l of wrapText(s.riddle, W - 250)) { drawText(g, l, 230, y, C.lgray); y += 11; }
    y += 6;
    drawText(g, 'Jak odkryć:', 230, y, C.lavender); y += 12;
    for (const l of wrapText(s.hint, W - 250)) { drawText(g, l, 230, y, C.yellow); y += 11; }
    y += 6;
    drawText(g, 'Efekt:', 230, y, C.lavender); y += 12;
    for (const l of wrapText(`${s.desc} ${s.while ? 'Działa tylko, dopóki warunek trwa.' : 'Działa do końca runu.'}`, W - 250)) { drawText(g, l, 230, y, known ? C.white : C.lgray); y += 11; }
    drawText(g, `Odkryte ${SECRETS.filter((x) => found.includes(x.id)).length}/${SECRETS.length}`, 10, 232, C.lavender);
  }

  /** Zakładka Unikaty: siatka (odkryte z ikoną), karta przedmiotu odkrytego unikatu albo znak zapytania. */
  private renderUniques(): void {
    const r = this.app.r, g = r.g, found = this.col.uniques;
    panel(r, 6, 32, 236, 160, C.slate);
    drawText(g, `Odkryte unikaty ${UNIQUES.filter((u) => found.includes(u.id)).length}/${UNIQUES.length}`, U_X, 37, C.lavender);
    UNIQUES.forEach((u, i) => {
      const x = U_X + (i % U_COLS) * U_STEP, y = U_Y + Math.floor(i / U_COLS) * U_STEP, known = found.includes(u.id);
      slot(r, x, y, U_TILE, known ? UNIQUE_COLOR : C.slate);
      if (known) drawSprite(g, BASE_BY_ID[u.base].icon, x + U_TILE / 2, y + U_TILE / 2);
      else drawText(g, '?', x + U_TILE / 2, y + 8, C.dgray, { align: 'center' });
      if (i === this.uSel) r.frame(x - 2, y - 2, U_TILE + 4, U_TILE + 4, C.white);
    });
    wrapText('Unikaty wypadają rzadko z bossów i elit. Mają stały efekt, który łamie zasady gry, i nie da się ich przekuć.', 216).forEach((l, i) =>
      drawText(g, l, U_X - 10, 132 + i * 11, C.dgray));
    const u = UNIQUES[this.uSel];
    if (found.includes(u.id)) drawItemCard(r, U_SAMPLES[this.uSel], 250, 40, 220, 170);
    else {
      panel(r, 250, 40, 220, 170, C.slate);
      drawText(g, '???', 360, 100, C.dgray, { align: 'center', scale: 2 });
      drawText(g, 'Nieodkryty unikat', 360, 130, C.dgray, { align: 'center' });
    }
  }

  render(): void {
    const r = this.app.r, g = r.g, col = this.col;
    r.clear(C.black);
    button(r, W - 116, 8, 108, 18, `[Tab] ${TAB_NAME[TABS[(TABS.indexOf(this.tab) + 1) % TABS.length]]} >`, { pulse: true, accent: this.tab === 'uniques' ? UNIQUE_COLOR : this.tab === 'secrets' ? C.hotpink : C.blue });
    if (this.tab === 'bestiary' || this.tab === 'achievements' || this.tab === 'feats') {
      const head = { bestiary: ['Bestiariusz', C.lavender], achievements: ['Osiągnięcia', C.lime], feats: ['Wyczyny', C.gold] }[this.tab] as [string, number];
      drawText(g, head[0], W / 2, 10, head[1], { align: 'center', scale: 2, outline: C.black });
      drawText(g, '[Esc] wróć', 12, 12, C.lgray);
      if (this.tab === 'bestiary') this.renderBestiary();
      else if (this.tab === 'achievements') this.renderAchievements();
      else this.renderFeats();
      return;
    }
    if (this.tab === 'secrets') {
      drawText(g, 'Księga sekretów', W / 2, 10, C.hotpink, { align: 'center', scale: 2, outline: C.black });
      drawText(g, '[Esc] wróć', 12, 12, C.lgray);
      this.renderSecrets();
      return;
    }
    if (this.tab === 'arsenal') {
      drawText(g, 'Arsenał', W / 2, 10, C.cyan, { align: 'center', scale: 2, outline: C.black });
      drawText(g, '[Esc] wróć', 12, 12, C.lgray);
      this.renderArsenal();
      return;
    }
    if (this.tab === 'uniques') {
      drawText(g, 'Kolekcja unikatów', W / 2, 10, UNIQUE_COLOR, { align: 'center', scale: 2, outline: C.black });
      drawText(g, '[Esc] wróć', 12, 12, C.lgray);
      this.renderUniques();
      return;
    }
    drawText(g, 'Kolekcja kart', W / 2, 10, C.yellow, { align: 'center', scale: 2, outline: C.black });
    drawText(g, '[Esc] wróć', 12, 12, C.lgray);
    const found = ORDERED.filter((c) => col.seen.includes(c.id)).length;
    panel(r, 6, 32, 282, 176, C.slate);
    drawText(g, `Odkryte ${found}/${ORDERED.length}    bany ${col.banned.length}/${BAL.cardBanSlots}`, GRID_X, 37, C.lavender);
    ORDERED.forEach((c, i) => {
      const [x, y] = this.tilePos(i);
      const known = col.seen.includes(c.id), banned = col.banned.includes(c.id);
      slot(r, x, y, TILE, known ? rarityColor(c.rarity, this.step) : C.slate);
      if (known) drawSprite(g, c.icon!, x + TILE / 2, y + TILE / 2);
      else r.withAlpha(0.3, () => drawSprite(g, c.icon!, x + TILE / 2, y + TILE / 2));
      if (banned) {
        r.withAlpha(0.55, () => r.rect(x + 2, y + 2, TILE - 4, TILE - 4, C.black));
        r.line(x + 4, y + 4, x + TILE - 5, y + TILE - 5, C.red, 2);
        r.line(x + TILE - 5, y + 4, x + 4, y + TILE - 5, C.red, 2);
      }
      if (i === this.sel) r.frame(x - 2, y - 2, TILE + 4, TILE + 4, C.white);
    });

    // Szczegóły zaznaczonej karty.
    const c = ORDERED[this.sel];
    const known = col.seen.includes(c.id), banned = col.banned.includes(c.id);
    if (known) {
      drawCard(r, c, CARD_X, CARD_Y, false, this.step, 0);
    } else {
      // Nieodkryta: opis widać, karta wyblakła (odkryje się w ofercie kart).
      r.withAlpha(0.5, () => drawCard(r, c, CARD_X, CARD_Y, false, this.step, 0));
      drawText(g, 'Jeszcze nie widziana', CARD_X + 68, CARD_Y - 10, C.dgray, { align: 'center' });
    }
    const info = [
      known ? `Wybrana ${col.picks[c.id] ?? 0} razy` : '',
      c.hero ? `Karta bohatera: ${HERO_BY_ID[c.hero].name}` : '',
      c.unlock && !this.app.save.achievements.includes(c.unlock) ? `Zablokowana: osiągnięcie ${ACHIEVEMENTS.find((x) => x.id === c.unlock)!.name}` : '',
      banned ? 'Zbanowana: nie pojawia się w ofertach' : '',
    ].filter(Boolean);
    info.forEach((l, i) => drawText(g, l, GRID_X, 213 + i * 10, banned && i === info.length - 1 ? C.salmon : C.lgray));
    button(r, CARD_X + 18, 214, 100, 16, banned ? 'Odbanuj [B]' : 'Zbanuj [B]', { active: banned, accent: C.red, col: known ? undefined : C.dgray });
    drawText(g, 'Zbanowane karty nie wypadają w ofertach. Banować można tylko odkryte (widziane w ofercie).', W / 2, 244, C.dgray, { align: 'center' });
    if (this.noteT > 0) drawText(g, this.note, W / 2, H - 14, C.salmon, { align: 'center', outline: C.black });
  }
}
