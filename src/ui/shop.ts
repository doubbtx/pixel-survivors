import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { fmt } from '../util/format';
import {
  SERVICES, ELIXIR_BY_ID, itemPrice, servicePrice, elixirPrice, refreshPrice, shopUpgradePrice, elixirLine,
  type ShopState,
} from '../data/shop';
import { buyItem, buyService, buyElixir, buyShopUpgrade, refreshShop, type BuyResult } from '../systems/shop';
import type { Run } from '../game/run';
import { CardPickView } from './cards';
import { drawItemSlot, drawItemCard } from './items';
import { button, dim, panel, slot, inside } from './widgets';

const CELL = 28;
const GAP = 35;
const COL_X = 16;
const ROW_Y = [52, 108, 164];
/** Usługi kuźni (materiały i zwoje) — osobny, trzeci rząd. */
const FORGE_SERVICES = new Set(['stone', 'ore', 'bless', 'dragon']);
const DET_X = 278, DET_W = 196;
const BTN_Y = 236;
/** Przyciski pod listą (x, szerokość): odśwież, ekwipunek, kowadło, wyjście — wspólne dla rysowania i kliknięć. */
const BTNS = { refresh: [10, 58], inv: [72, 56], anvil: [132, 46], close: [182, 88] } as const;

/** Pozycja oferty: przedmiot, usługa albo eliksir. */
type Entry =
  | { kind: 'item'; i: number }
  | { kind: 'service'; id: (typeof SERVICES)[number]['id'] }
  | { kind: 'elixir'; id: string }
  | { kind: 'upgrade' };

export type ShopAction = 'close' | 'inventory' | 'anvil' | null;

/**
 * Sklep między poziomami: rząd przedmiotów, rząd usług/eliksirów i rząd kuźni (materiały, zwoje), po prawej szczegóły
 * zaznaczonej pozycji (przedmiot z porównaniem do założonego). Enter/klik: kup, R: odśwież przedmioty,
 * I: ekwipunek (sprzedaż/zakładanie), K: kowadło, Esc: wyjdź. Karta otwiera wybór karty w tym samym oknie.
 */
export class ShopView {
  private cx = 0;
  private cy = 0;
  private note = '';
  private noteT = 0;
  private noteBad = false;
  private lastMouse = 0;
  private cardPick: CardPickView | null = null;

  /** `onChange` — po każdym zakupie (zapis runu); `exitLabel` — podpis przycisku wyjścia. */
  constructor(private readonly run: Run, private readonly onChange: () => void, private readonly exitLabel: string) {}

  private get shop(): ShopState {
    return this.run.shop!;
  }

  private row(cy: number): Entry[] {
    // Rząd przedmiotów kończy się rozbudową sklepu.
    if (cy === 0) return [...this.shop.items.map((_, i) => ({ kind: 'item', i }) as Entry), { kind: 'upgrade' }];
    if (cy === 2) return SERVICES.filter((s) => FORGE_SERVICES.has(s.id)).map((s) => ({ kind: 'service', id: s.id }) as Entry);
    return [
      ...SERVICES.filter((s) => !FORGE_SERVICES.has(s.id)).map((s) => ({ kind: 'service', id: s.id }) as Entry),
      ...this.shop.elixirs.map((id) => ({ kind: 'elixir', id }) as Entry),
    ];
  }

  private price(e: Entry): number {
    const shop = this.shop;
    if (e.kind === 'item') { const it = shop.items[e.i]; return it ? itemPrice(it, shop) : 0; }
    if (e.kind === 'upgrade') return shopUpgradePrice(shop);
    if (e.kind === 'service') return servicePrice(shop, e.id);
    return elixirPrice(shop, this.run.elixirsBought);
  }

  /** Czy pozycję można jeszcze kupić (nie sprzedana / nie wyprzedana). */
  private available(e: Entry): boolean {
    const shop = this.shop;
    if (e.kind === 'item') return !!shop.items[e.i];
    if (e.kind === 'upgrade') return this.run.shopLevel < BAL.shopUpgrade.max;
    return (shop.stock[e.kind === 'service' ? e.id : `elixir:${e.id}`] ?? 0) > 0;
  }

  private say(res: BuyResult): void {
    this.note = res.note;
    this.noteT = 2.5;
    this.noteBad = !res.ok;
    sfx.play(res.ok ? 'pickup' : 'hurt');
    if (res.ok) this.onChange();
  }

  private buy(e: Entry): void {
    const run = this.run;
    const res = e.kind === 'item' ? buyItem(run, e.i) : e.kind === 'upgrade' ? buyShopUpgrade(run) : e.kind === 'service' ? buyService(run, e.id) : buyElixir(run, e.id);
    // Karta: zapis dopiero po wyborze (przerwanie wyboru nie zabiera złota).
    if (res.card) { this.cardPick = new CardPickView(run, 'shop'); return; }
    this.say(res);
  }

  private refresh(): void {
    this.say(refreshShop(this.run));
  }

  private cellPos(cx: number, cy: number): [number, number] {
    return [COL_X + cx * GAP, ROW_Y[cy]];
  }

  update(input: Input, dt: number): ShopAction {
    if (this.cardPick) {
      if (this.cardPick.update(input)) { this.cardPick = null; this.onChange(); }
      return null;
    }
    this.noteT = Math.max(0, this.noteT - dt);
    if (input.pressed('back') || input.pressed('pause')) return 'close';
    if (input.pressed('inventory')) return 'inventory';
    if (input.pressed('anvil')) return 'anvil';
    if (input.pressed('up')) this.cy = (this.cy + 2) % 3;
    if (input.pressed('down')) this.cy = (this.cy + 1) % 3;
    const n = this.row(this.cy).length;
    this.cx = Math.min(this.cx, n - 1);
    if (input.pressed('left')) this.cx = (this.cx - 1 + n) % n;
    if (input.pressed('right')) this.cx = (this.cx + 1) % n;
    if (input.pressed('confirm')) this.buy(this.row(this.cy)[this.cx]);
    if (input.pressed('reroll')) this.refresh();

    const m = input.mouse;
    for (let cy = 0; cy < 3; cy++) {
      const row = this.row(cy);
      for (let cx = 0; cx < row.length; cx++) {
        const [x, y] = this.cellPos(cx, cy);
        if (!inside(m.x, m.y, x, y, CELL, CELL)) continue;
        if (m.lastMove !== this.lastMouse) { this.cx = cx; this.cy = cy; }
        if (input.pressed('click')) { this.cx = cx; this.cy = cy; this.buy(row[cx]); }
      }
    }
    if (input.pressed('click')) {
      if (inside(m.x, m.y, BTNS.refresh[0], BTN_Y, BTNS.refresh[1], 16)) this.refresh();
      if (inside(m.x, m.y, BTNS.inv[0], BTN_Y, BTNS.inv[1], 16)) return 'inventory';
      if (inside(m.x, m.y, BTNS.anvil[0], BTN_Y, BTNS.anvil[1], 16)) return 'anvil';
      if (inside(m.x, m.y, BTNS.close[0], BTN_Y, BTNS.close[1], 16)) return 'close';
      if (inside(m.x, m.y, DET_X, BTN_Y, DET_W, 16)) this.buy(this.row(this.cy)[this.cx]);
    }
    this.lastMouse = m.lastMove;
    return null;
  }

  render(r: Renderer): void {
    if (this.cardPick) { this.cardPick.render(r); return; }
    const g = r.g, run = this.run, shop = this.shop;
    dim(r);
    drawText(g, 'Sklep', W / 2, 10, C.yellow, { align: 'center', scale: 2, outline: C.black });
    drawSprite(g, 'coin', W - 70, 18);
    drawText(g, fmt(run.gold), W - 62, 13, C.yellow, { outline: C.black });

    panel(r, 6, 34, 266, 196);
    drawText(g, `Przedmioty (poz. ${shop.depth})   sklep: poziom ${run.shopLevel}`, 14, 40, C.lavender);
    drawText(g, 'Usługi i eliksiry', 14, 97, C.lavender);
    drawText(g, `Kuźnia: materiały i zwoje (masz: ${run.mats.stone} kam., ${run.mats.ore} rudy)`, 14, 153, C.lavender);
    for (let cy = 0; cy < 3; cy++) {
      this.row(cy).forEach((e, cx) => {
        const [x, y] = this.cellPos(cx, cy);
        const on = cx === this.cx && cy === this.cy;
        const avail = this.available(e);
        if (e.kind === 'item') {
          drawItemSlot(r, shop.items[e.i], x, y, CELL, on);
        } else {
          slot(r, x, y, CELL, e.kind === 'elixir' ? C.pink : e.kind === 'upgrade' ? C.orange : C.gold);
          const icon = e.kind === 'upgrade' ? 'sh_upgrade' : e.kind === 'service' ? SERVICES.find((s) => s.id === e.id)!.icon : ELIXIR_BY_ID[e.id].icon;
          if (avail) drawSprite(g, icon, x + CELL / 2, y + CELL / 2);
          else r.withAlpha(0.25, () => drawSprite(g, icon, x + CELL / 2, y + CELL / 2));
          if (on) r.frame(x - 1, y - 1, CELL + 2, CELL + 2, C.yellow);
        }
        const price = this.price(e);
        const label = avail ? String(price) : '-';
        drawText(g, label, x + CELL / 2, y + CELL + 2, !avail ? C.lavender : run.gold >= price ? C.yellow : C.red, { align: 'center' });
      });
    }
    const lines = [
      `HP ${Math.ceil(run.player.hp)}/${Math.ceil(run.stats.maxHp)}  plecak ${run.bag.length}/${BAL.bagSize}  odł. ${run.shards}  losowania ${run.rerolls}/${run.banishes}/${run.cardRerolls}`,
      'Enter/klik: kup  R: odśwież  I: ekwipunek  K: kowadło',
    ];
    lines.forEach((l, i) => drawText(g, l, 14, 206 + i * 11, i < 1 ? C.lgray : C.lavender));

    this.renderDetails(r);

    const btn = ([x, w]: readonly [number, number], label: string, col: number) => {
      button(r, x, BTN_Y, w, 16, label, { col });
    };
    const rp = refreshPrice(shop);
    btn(BTNS.refresh, `Odśwież ${rp}`, run.gold >= rp ? C.yellow : C.red);
    btn(BTNS.inv, 'Ekwipunek', C.lgray);
    btn(BTNS.anvil, 'Kowadło', this.run.expedition?.noForge ? C.dgray : C.orange);
    btn(BTNS.close, this.exitLabel, C.white);
    if (this.noteT > 0) drawText(g, this.note, W / 2, H - 13, this.noteBad ? C.salmon : C.lime, { align: 'center', outline: C.black });
  }

  private renderDetails(r: Renderer): void {
    const g = r.g, run = this.run, shop = this.shop;
    const e = this.row(this.cy)[this.cx];
    const avail = this.available(e);
    const price = this.price(e);
    if (e.kind === 'item' && shop.items[e.i]) {
      const it = shop.items[e.i]!;
      drawItemCard(r, it, DET_X, 34, DET_W, 196, run.equipment[run.slotFor(it)], false, run.stats);
    } else if (e.kind === 'item') {
      panel(r, DET_X, 34, DET_W, 196, C.slate);
      drawText(g, 'Sprzedane', DET_X + DET_W / 2, 124, C.lavender, { align: 'center' });
    } else if (e.kind === 'upgrade') {
      // Rozbudowa sklepu: co daje następny poziom.
      const U = BAL.shopUpgrade, lvl = run.shopLevel, cx = DET_X + DET_W / 2;
      panel(r, DET_X, 34, DET_W, 196);
      drawSprite(g, 'sh_upgrade', cx, 66, { scale: 2 });
      drawText(g, `Rozbudowa sklepu (${lvl}/${U.max})`, cx, 92, C.white, { align: 'center', shadow: C.black });
      const lines = lvl >= U.max ? ['Sklep w pełni rozbudowany.'] : [
        `Lepsza jakość przedmiotów (+${Math.round(U.luck * 100)}%).`,
        `Wszystko ${Math.round(U.discount * 100)}% taniej.`,
        lvl + 1 === 3 || lvl + 1 === 5 ? '+1 miejsce na przedmiot!' : 'Na poziomie 3 i 5: +1 przedmiot.',
        'Działa do końca runu.',
      ];
      lines.forEach((l, i) => drawText(g, l, cx, 112 + i * 12, i === 2 ? C.lime : C.lgray, { align: 'center' }));
    } else {
      const svc = e.kind === 'service' ? SERVICES.find((s) => s.id === e.id)! : null;
      const el = e.kind === 'elixir' ? ELIXIR_BY_ID[e.id] : null;
      const col = el ? C.pink : C.gold;
      panel(r, DET_X, 34, DET_W, 196);
      const cx = DET_X + DET_W / 2;
      r.withAlpha(0.25, () => r.circle(cx, 66, 19, col, true));
      r.withAlpha(0.7, () => r.circle(cx, 66, 15, C.black, true));
      r.circle(cx, 66, 16, col);
      drawSprite(g, svc ? svc.icon : el!.icon, cx, 66, { scale: 2 });
      drawText(g, svc ? svc.name : el!.name, cx, 92, C.white, { align: 'center', shadow: C.black });
      let ly = 110;
      for (const l of wrapText(svc ? svc.desc : elixirLine(el!, shop.depth), DET_W - 20)) {
        drawText(g, l, cx, ly, C.lgray, { align: 'center' });
        ly += 11;
      }
      const left = shop.stock[svc ? svc.id : `elixir:${el!.id}`] ?? 0;
      drawText(g, `Zostało: ${left}`, cx, 160, C.lavender, { align: 'center' });
      if (el) drawText(g, `Kupione eliksiry: ${run.elixirsBought}`, cx, 174, C.lavender, { align: 'center' });
    }
    if (!avail) return;
    button(r, DET_X, BTN_Y, DET_W, 16, `Kup za ${price} zł`, { col: run.gold >= price ? C.yellow : C.red, accent: C.gold, pulse: run.gold >= price });
  }
}
