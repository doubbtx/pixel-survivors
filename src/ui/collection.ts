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
import { panel, slot, inside } from './widgets';
import { UNIQUES, UNIQUE_COLOR, BASE_BY_ID, rollUnique, type Item } from '../data/items';
import { drawItemCard } from './items';
import { SECRETS } from '../data/secrets';

const COLS = 12, TILE = 18, STEP = 19;
const GRID_X = 12, GRID_Y = 50;
const CARD_X = 300, CARD_Y = 40;
const RARITY_ORDER = { silver: 0, gold: 1, prism: 2 } as const;

/** Unikaty: siatka i przykładowe egzemplarze (poziom 1) do karty przedmiotu. */
const U_COLS = 5, U_TILE = 28, U_STEP = 32, U_X = 24, U_Y = 56;
const U_SAMPLES: Item[] = UNIQUES.map((u) => rollUnique(1, u.id));

/** Karty w kolejności: rzadkość, potem karty ogólne przed kartami bohaterów. */
const ORDERED: CardDef[] = [...CARDS].sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || Number(!!a.hero) - Number(!!b.hero));

/**
 * Kolekcja kart (z menu głównego): wszystkie karty, odkryte (widziane w ofercie) i nieodkryte,
 * liczba wyborów oraz bany — zbanowana karta nie pojawia się w żadnej ofercie (limit BAL.cardBanSlots).
 * Strzałki / mysz: wybór, B / klik w przycisk: ban, Esc: wróć. Tab: zakładka Unikaty (odkryte unikaty z opisem efektu).
 */
export class CollectionScreen implements Screen {
  private sel = 0;
  private tab: 'cards' | 'uniques' | 'secrets' = 'cards';
  private sSel = 0;
  private uSel = 0;
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
    if (inp.pressed('inventory') || (inp.pressed('click') && inside(inp.mouse.x, inp.mouse.y, W - 96, 8, 88, 18))) {
      this.tab = this.tab === 'cards' ? 'uniques' : this.tab === 'uniques' ? 'secrets' : 'cards';
      sfx.play('select');
      return;
    }
    if (this.tab === 'uniques') { this.updateUniques(); return; }
    if (this.tab === 'secrets') { this.updateSecrets(); return; }
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

  private updateSecrets(): void {
    const inp = this.app.input, n = SECRETS.length;
    if (inp.pressed('up')) this.sSel = (this.sSel + n - 1) % n;
    if (inp.pressed('down')) this.sSel = (this.sSel + 1) % n;
    const m = inp.mouse;
    SECRETS.forEach((_, i) => {
      if (inside(m.x, m.y, 10, 40 + i * 17, 200, 16) && (m.lastMove !== this.lastMouse || inp.pressed('click'))) this.sSel = i;
    });
    if (inp.pressed('click') && inside(m.x, m.y, 8, 8, 70, 18)) this.app.go(this.back);
    this.lastMouse = m.lastMove;
  }

  /** Zakładka Sekrety: lista (odkryte z nazwą, nieodkryte jako ???) i szczegóły: zagadka, a po odkryciu efekt. */
  private renderSecrets(): void {
    const r = this.app.r, g = r.g, found = this.col.secrets;
    SECRETS.forEach((s, i) => {
      const y = 40 + i * 17, known = found.includes(s.id), on = i === this.sSel;
      panel(r, 10, y, 200, 16, on ? C.hotpink : C.slate);
      drawText(g, known ? s.name : '???', 18, y + 2, known ? C.white : C.dgray);
      if (s.hero) drawText(g, HERO_BY_ID[s.hero].name, 204, y + 2, HERO_BY_ID[s.hero].color, { align: 'right' });
    });
    const s = SECRETS[this.sSel], known = found.includes(s.id);
    panel(r, 220, 40, W - 230, 186, known ? C.hotpink : C.slate);
    drawText(g, known ? s.name : 'Nieodkryty sekret', 230, 48, known ? C.hotpink : C.dgray, { scale: 2 });
    let y = 76;
    drawText(g, 'Zagadka:', 230, y, C.lavender); y += 12;
    for (const l of wrapText(s.riddle, W - 250)) { drawText(g, l, 230, y, C.lgray); y += 11; }
    y += 8;
    if (known) {
      drawText(g, 'Efekt:', 230, y, C.lavender); y += 12;
      for (const l of wrapText(`${s.desc} ${s.while ? 'Działa tylko, dopóki warunek trwa.' : 'Działa do końca runu.'}`, W - 250)) { drawText(g, l, 230, y, C.white); y += 11; }
    } else drawText(g, 'Spełnij warunek w trakcie runu, żeby go odkryć.', 230, y, C.dgray);
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
    panel(r, W - 96, 8, 88, 18, this.tab === 'uniques' ? UNIQUE_COLOR : this.tab === 'secrets' ? C.hotpink : C.slate);
    drawText(g, this.tab === 'cards' ? '[Tab] Unikaty' : this.tab === 'uniques' ? '[Tab] Sekrety' : '[Tab] Karty', W - 52, 11, C.white, { align: 'center' });
    if (this.tab === 'secrets') {
      drawText(g, 'Księga sekretów', W / 2, 10, C.hotpink, { align: 'center', scale: 2, outline: C.black });
      drawText(g, '[Esc] wróć', 12, 12, C.lgray);
      this.renderSecrets();
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
    panel(r, 6, 32, 236, 176, C.slate);
    drawText(g, `Odkryte ${found}/${ORDERED.length}    bany ${col.banned.length}/${BAL.cardBanSlots}`, GRID_X, 37, C.lavender);
    ORDERED.forEach((c, i) => {
      const [x, y] = this.tilePos(i);
      const known = col.seen.includes(c.id), banned = col.banned.includes(c.id);
      slot(r, x, y, TILE, known ? rarityColor(c.rarity, this.step) : C.slate);
      if (known) drawSprite(g, c.icon!, x + TILE / 2, y + TILE / 2);
      else drawText(g, '?', x + TILE / 2, y + 4, C.dgray, { align: 'center' });
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
      panel(r, CARD_X, CARD_Y, 136, 166, C.slate);
      drawText(g, '???', CARD_X + 68, CARD_Y + 60, C.dgray, { align: 'center', scale: 2 });
      wrapText('Nieodkryta. Pojawi się tu, gdy zobaczysz ją w ofercie kart.', 116).forEach((l, i) =>
        drawText(g, l, CARD_X + 68, CARD_Y + 96 + i * 11, C.dgray, { align: 'center' }));
    }
    const info = [
      known ? `Wybrana ${col.picks[c.id] ?? 0} razy` : '',
      c.hero ? `Karta bohatera: ${HERO_BY_ID[c.hero].name}` : '',
      banned ? 'Zbanowana: nie pojawia się w ofertach' : '',
    ].filter(Boolean);
    info.forEach((l, i) => drawText(g, l, GRID_X, 213 + i * 10, banned && i === info.length - 1 ? C.salmon : C.lgray));
    panel(r, CARD_X + 18, 214, 100, 16, banned ? C.red : C.slate);
    drawText(g, banned ? 'Odbanuj [B]' : 'Zbanuj [B]', CARD_X + 68, 216, known ? C.white : C.dgray, { align: 'center' });
    drawText(g, 'Zbanowane karty nie wypadają w ofertach. Banować można tylko odkryte.', W / 2, 244, C.dgray, { align: 'center' });
    if (this.noteT > 0) drawText(g, this.note, W / 2, H - 14, C.salmon, { align: 'center', outline: C.black });
  }
}
