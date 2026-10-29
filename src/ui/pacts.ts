import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText } from '../core/font';
import { sfx } from '../core/audio';
import { BAL } from '../data/balance';
import { PACTS, pactLevel, pactDesc, PACT_BADGES } from '../data/pacts';
import type { App, Screen } from './app';
import { button, panel, inside, titleBar } from './widgets';

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
    drawText(g, `Poziom Paktu: ${lvl}    esencja x${(1 + BAL.pacts.essencePer * lvl).toFixed(2)}`, W / 2, 28, lvl ? C.yellow : C.lavender, { align: 'center' });
    PACTS.forEach((p, i) => {
      const y = TOP + i * ROW_H, on = i === this.sel, cur = this.chosen[p.id] ?? 0;
      panel(r, X, y, RW, ROW_H - 2, on ? C.salmon : cur ? C.dred : C.slate);
      drawText(g, p.name, X + 8, y + 4, cur ? C.white : C.lgray);
      drawText(g, pactDesc(p, cur), X + 120, y + 4, cur ? C.peach : C.lavender);
      for (let l = 1; l <= p.max; l++) {
        const bx = X + RW - 14 - (p.max - l) * 14;
        r.rect(bx, y + 4, 10, 10, C.black);
        r.rect(bx + 1, y + 5, 8, 8, l <= cur ? C.red : C.navy);
        if (l <= cur) r.rect(bx + 2, y + 6, 3, 2, C.salmon);
      }
    });
    const badges = PACT_BADGES.map((b) => `${b.name} ${b.from}`).join(', ');
    drawText(g, `Odznaki bohatera za bossa pokonanego z Paktem: ${badges}.`, W / 2, TOP + PACTS.length * ROW_H + 4, C.lavender, { align: 'center' });
    drawText(g, 'Strzałki: wybór i poziom    R: wyzeruj    Esc: wróć', W / 2, H - 40, C.lavender, { align: 'center' });
    button(r, W / 2 - 40, H - 24, 80, 16, 'Wstecz [Esc]');
    button(r, W / 2 + 46, H - 24, 80, 16, 'Reset [R]');
  }
}
