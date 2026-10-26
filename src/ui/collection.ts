import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { CARDS, RARITY, type CardDef } from '../data/cards';
import { HERO_BY_ID } from '../data/heroes';
import type { App, Screen } from './app';
import { drawCard, rarityColor } from './cards';
import { panel, slot, inside } from './widgets';

const COLS = 10, TILE = 20, STEP = 22;
const GRID_X = 14, GRID_Y = 52;
const CARD_X = 300, CARD_Y = 40;
const RARITY_ORDER = { silver: 0, gold: 1, prism: 2 } as const;

/** Karty w kolejności: rzadkość, potem karty ogólne przed kartami bohaterów. */
const ORDERED: CardDef[] = [...CARDS].sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || Number(!!a.hero) - Number(!!b.hero));

/**
 * Kolekcja kart (z menu głównego): wszystkie karty, odkryte (widziane w ofercie) i nieodkryte,
 * liczba wyborów oraz bany — zbanowana karta nie pojawia się w żadnej ofercie (limit BAL.cardBanSlots).
 * Strzałki / mysz: wybór, B / klik w przycisk: ban, Esc: wróć.
 */
export class CollectionScreen implements Screen {
  private sel = 0;
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

  render(): void {
    const r = this.app.r, g = r.g, col = this.col;
    r.clear(C.black);
    drawText(g, 'Kolekcja kart', W / 2, 10, C.yellow, { align: 'center', scale: 2, outline: C.black });
    drawText(g, '[Esc] wróć', 12, 12, C.lgray);
    const found = ORDERED.filter((c) => col.seen.includes(c.id)).length;
    panel(r, 6, 32, 236, 160, C.slate);
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
    const legend = [
      [C.lgray, RARITY.silver.name], [C.yellow, RARITY.gold.name], [C.pink, RARITY.prism.name],
    ] as const;
    legend.forEach(([cl, name], i) => drawText(g, name, GRID_X + i * 72, 178, cl));

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
    info.forEach((l, i) => drawText(g, l, GRID_X, 198 + i * 12, banned && i === info.length - 1 ? C.salmon : C.lgray));
    panel(r, CARD_X + 18, 214, 100, 16, banned ? C.red : C.slate);
    drawText(g, banned ? 'Odbanuj [B]' : 'Zbanuj [B]', CARD_X + 68, 216, known ? C.white : C.dgray, { align: 'center' });
    drawText(g, 'Zbanowane karty nie wypadają w ofertach. Banować można tylko odkryte.', W / 2, 244, C.dgray, { align: 'center' });
    if (this.noteT > 0) drawText(g, this.note, W / 2, H - 14, C.salmon, { align: 'center', outline: C.black });
  }
}
