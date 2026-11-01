import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, textWidth, smallS } from '../core/font';
import { sfx } from '../core/audio';
import { BAL } from '../data/balance';
import { PACTS, pactLevel, pactDesc, PACT_BADGES } from '../data/pacts';
import type { App, Screen } from './app';
import { button, panel, inside, titleBar, hovered, inlineStat } from './widgets';
import { UI } from './theme';

const ROW_H = 21, TOP = 40, X = 20, RW = W - 40;

/**
 * Pakty ryzyka (z ekranu wyboru bohatera): strzałki góra/dół wybór, lewo/prawo poziom, klik w kropki ustawia poziom,
 * R zeruje wszystko, Esc / Enter wraca. Wybór zapisuje się od razu (`save.pacts.chosen`) i działa od następnego runu.
 */
export class PactScreen implements Screen {
  private sel = 0;

  constructor(private readonly app: App, private readonly back: Screen) {}

  private get chosen(): Record<string, number> {
    return this.app.save.pacts.chosen;
  }

  private set(id: string, lvl: number): void {
    const p = PACTS.find((x) => x.id === id)!;
    const v = Math.max(0, Math.min(p.max, lvl));
    if (v === (this.chosen[id] ?? 0)) return;
    if (v) this.chosen[id] = v;
    else delete this.chosen[id];
    this.app.persist();
    sfx.play('select');
  }

  update(): void {
    const inp = this.app.input, n = PACTS.length;
    if (inp.pressed('back') || inp.pressed('confirm') || inp.pressed('pause')) { this.app.go(this.back); return; }
    if (inp.pressed('up')) this.sel = (this.sel - 1 + n) % n;
    if (inp.pressed('down')) this.sel = (this.sel + 1) % n;
    const p = PACTS[this.sel];
    if (inp.pressed('left')) this.set(p.id, (this.chosen[p.id] ?? 0) - 1);
    if (inp.pressed('right')) this.set(p.id, (this.chosen[p.id] ?? 0) + 1);
    if (inp.pressed('reroll') || (inp.pressed('click') && inside(inp.mouse.x, inp.mouse.y, W / 2 + 46, H - 24, 80, 16))) { for (const k of Object.keys(this.chosen)) delete this.chosen[k]; this.app.persist(); sfx.play('select'); }
    if (!inp.pressed('click')) return;
    const m = inp.mouse;
    PACTS.forEach((q, i) => {
      const y = TOP + i * ROW_H;
      if (!inside(m.x, m.y, X, y, RW, ROW_H - 2)) return;
      this.sel = i;
      // Kropki poziomów po prawej: klik w kropkę ustawia poziom (w już ustawioną — o jeden niżej).
      for (let l = 1; l <= q.max; l++) {
        if (inside(m.x, m.y, X + RW - 14 - (q.max - l) * 14, y + 4, 12, 12)) this.set(q.id, (this.chosen[q.id] ?? 0) === l ? l - 1 : l);
      }
    });
    if (inside(m.x, m.y, W / 2 - 40, H - 24, 80, 16)) this.app.go(this.back);
  }

  render(): void {
    const r = this.app.r, g = r.g, lvl = pactLevel(this.chosen);
    r.clear(C.black);
    titleBar(r, 'Pakty ryzyka', 4);
    // Liczby Paktu w jednym wierszu pod tytułem (wyśrodkowane).
    const lv = ['Pact level', String(lvl)], ess = ['Essence', `x${(1 + BAL.pacts.essencePer * lvl).toFixed(2)}`];
    const sc = smallS(), wOf = ([a, b]: string[]) => textWidth(a) * sc + 4 + textWidth(b);
    const sx = W / 2 - (wOf(lv) + 16 + wOf(ess)) / 2;
    inlineStat(r, sx, 28, lv[0], lv[1], lvl ? C.salmon : C.white);
    inlineStat(r, sx + wOf(lv) + 16, 28, ess[0], ess[1], lvl ? C.cyan : C.white);
    PACTS.forEach((p, i) => {
      const y = TOP + i * ROW_H, on = i === this.sel, cur = this.chosen[p.id] ?? 0;
      // Wiersz: zaznaczony jaśniejszy ze złotym paskiem po lewej, aktywny pakt z czerwoną ramką.
      panel(r, X, y, RW, ROW_H - 2, cur ? C.red : !on && hovered(X, y, RW, ROW_H - 2) ? C.lavender : UI.border, on ? C.slate : C.navy);
      if (on) r.roundRect(X + 2, y + 4, 2, ROW_H - 10, 1, C.gold);
      drawText(g, p.name, X + 10, y + 4, cur ? C.white : C.lgray);
      drawText(g, pactDesc(p, cur), X + 120, y + 4, cur ? C.peach : C.lavender);
      // Poziomy: zaokrąglone kratki (klik ustawia poziom).
      for (let l = 1; l <= p.max; l++) {
        const bx = X + RW - 14 - (p.max - l) * 14;
        r.withAlpha(l <= cur ? 1 : 0.7, () => r.roundRect(bx, y + 4, 10, 10, 2.5, l <= cur ? C.red : C.black));
        r.roundFrame(bx, y + 4, 10, 10, 2.5, l <= cur ? C.salmon : C.slate, 0.75);
      }
    });
    const badges = PACT_BADGES.map((b) => `${b.name} ${b.from}`).join(', ');
    drawText(g, `Odznaki bohatera za bossa pokonanego z Paktem: ${badges}.`, W / 2, TOP + PACTS.length * ROW_H + 4, C.lavender, { align: 'center' });
    drawText(g, 'Strzałki: wybór i poziom    R: wyzeruj    Esc: wróć', W / 2, H - 38, C.lavender, { align: 'center', scale: smallS() });
    button(r, W / 2 - 40, H - 24, 80, 16, 'Wstecz [Esc]');
    button(r, W / 2 + 46, H - 24, 80, 16, 'Reset [R]');
  }
}
