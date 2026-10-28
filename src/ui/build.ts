import { W, H, type Renderer } from '../core/renderer';
import type { Input } from '../core/input';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { WEAPONS, WEAPON_BY_ID, FUSIONS, maxLevel, describeLevel } from '../data/weapons';
import { PASSIVE_BY_ID } from '../data/passives';
import { AUGMENT_BY_ID, weaponBase, augmentWorks, fusionAugments, FUSION_RULES } from '../data/augments';
import { ELEMENTS, WEAPON_ELEMENT, ELEM, type Element } from '../data/elements';
import { BAL } from '../data/balance';
import { buildElements } from '../systems/tasks';
import { bonusLines } from '../data/upgrades';
import type { Run } from '../game/run';
import { dim, panel, slot, inside, hovered, button } from './widgets';

const CELL = 22, STEP = 26, GX = 16, WY = 50, PY = 116, COLS = 6;
const DX = 186, SMALL = { scale: 0.75 } as const;

/** Reakcje żywiołów (game/run.ts react) z opisem skutku; liczby z BAL.reactions. */
function reactions(): { a: Element; b: Element; name: string; col: number; desc: string }[] {
  const R = BAL.reactions, pct = (v: number) => `${Math.round(v * 100)}%`;
  return [
    { a: 'fire', b: 'ice', name: 'Para', col: C.lgray, desc: `ogłusza na ${R.steam.stun} s i zadaje ${pct(R.steam.mul)} trafienia. Zużywa oba stany.` },
    { a: 'lightning', b: 'ice', name: 'Kruszenie', col: C.cyan, desc: `następne trafienie zadaje x${R.shatter.mul} obrażeń. Zużywa lód.` },
    { a: 'fire', b: 'poison', name: 'Wybuch toksyn', col: C.lime, desc: `wybuch wokół wroga za całą truciznę x${R.toxic.mul}. Zużywa truciznę.` },
    { a: 'lightning', b: 'poison', name: 'Przewodzenie', col: C.yellow, desc: `trucizna przeskakuje na ${R.conduct.n} pobliskich wrogów.` },
    { a: 'fire', b: 'lightning', name: 'Przeciążenie', col: C.orange, desc: `wybuch z odrzutem za ${pct(R.overload.mul)} trafienia. Zużywa porażenie.` },
  ];
}

const STATES: [Element, string][] = [
  ['fire', `podpalenie: ${Math.round(ELEM.burnRatio * 100)}% trafienia na sekundę przez ${ELEM.burnTime} s`],
  ['ice', `spowolnienie ${Math.round(ELEM.chillSlow * 100)}%, co ${ELEM.freezeStacks}. trafienie zamraża`],
  ['lightning', `wróg dostaje +${Math.round((ELEM.shockMul - 1) * 100)}% obrażeń przez ${ELEM.shockTime} s`],
  ['poison', `do ${ELEM.poisonMaxStacks} warstw, każda ${Math.round(ELEM.poisonRatio * 100)}% trafienia na sekundę`],
];

/** Gniazdo przepisu: ikona w ramce, zielona gdy składnik jest gotowy, szara gdy go brakuje. */
function part(r: Renderer, icon: string, x: number, y: number, ok: boolean): void {
  slot(r, x, y, 18, ok ? C.lime : C.slate);
  if (ok) drawSprite(r.g, icon, x + 9, y + 9);
  else r.withAlpha(0.45, () => drawSprite(r.g, icon, x + 9, y + 9));
}

/** "A + B > C" z ikonami: gotowe składniki na zielono, wynik w złotej ramce. */
function recipe(r: Renderer, x: number, y: number, a: [string, boolean], b: [string, boolean], result: string): void {
  part(r, a[0], x, y, a[1]);
  drawText(r.g, '+', x + 22, y + 5, C.lgray, { outline: C.black });
  part(r, b[0], x + 30, y, b[1]);
  drawText(r.g, '>', x + 52, y + 5, C.yellow, { outline: C.black });
  slot(r, x + 60, y, 18, C.gold);
  drawSprite(r.g, result, x + 69, y + 9);
}

/**
 * Bronie i pasywki w trakcie runu (pauza albo klawisz C): siatka posiadanych broni i pasywek, a obok szczegóły zaznaczonej —
 * opis, następny poziom, bonusy jakości, augmenty, ewolucja i fuzje jako ikony (zielone = składnik gotowy) albo,
 * dla pasywki, bronie, które ewoluuje.
 */
export class BuildView {
  private sel = 0;
  private lastMouse = 0;
  /** Prawa strona: szczegóły zaznaczonego albo tabela żywiołów i reakcji (Tab). */
  private elems = false;

  constructor(private readonly run: Run) {}

  private get count(): number {
    return this.run.weapons.length + this.run.passives.length;
  }

  private cellPos(i: number): [number, number] {
    const nw = this.run.weapons.length, p = i >= nw, k = p ? i - nw : i;
    return [GX + (k % COLS) * STEP, (p ? PY : WY) + Math.floor(k / COLS) * STEP];
  }

  /** Zwraca true, gdy ekran ma zostać zamknięty. */
  update(input: Input): boolean {
    if (input.pressed('back') || input.pressed('pause') || input.pressed('build') || input.pressed('confirm')) return true;
    const m = input.mouse;
    if (input.pressed('inventory') || (input.pressed('click') && inside(m.x, m.y, 80, H - 26, 90, 16))) { this.elems = !this.elems; sfx.play('select'); }
    const n = this.count;
    if (n) {
      if (input.pressed('left') || input.pressed('up')) { this.sel = (this.sel - 1 + n) % n; sfx.play('select'); }
      if (input.pressed('right') || input.pressed('down')) { this.sel = (this.sel + 1) % n; sfx.play('select'); }
    }
    for (let i = 0; i < n; i++) {
      const [x, y] = this.cellPos(i);
      if (inside(m.x, m.y, x, y, CELL, CELL) && (m.lastMove !== this.lastMouse || input.pressed('click'))) { this.sel = i; if (input.pressed('click')) this.elems = false; }
    }
    this.lastMouse = m.lastMove;
    return input.pressed('click') && inside(m.x, m.y, 14, H - 26, 60, 16);
  }

  render(r: Renderer): void {
    const g = r.g, run = this.run;
    dim(r);
    drawText(g, 'Bronie i pasywki', W / 2, 6, C.yellow, { align: 'center', scale: 2, outline: C.black });
    panel(r, 6, 34, DX - 12, H - 66);
    drawText(g, 'Bronie', GX, 38, C.lavender);
    drawText(g, 'Pasywki', GX, PY - 12, C.lavender);
    const nw = run.weapons.length;
    for (let i = 0; i < this.count; i++) {
      const [x, y] = this.cellPos(i), w = run.weapons[i], p = run.passives[i - nw];
      const on = i === this.sel || hovered(x, y, CELL, CELL);
      slot(r, x, y, CELL, i === this.sel ? C.yellow : on ? C.lavender : w?.def.evolved ? C.gold : C.slate);
      drawSprite(g, w ? w.def.icon : PASSIVE_BY_ID[p.id].icon, x + CELL / 2, y + CELL / 2);
      drawText(g, w ? (w.def.evolved ? '*' : String(w.level)) : String(p.level), x + CELL - 2, y + CELL - 10, C.white, { align: 'right', outline: C.black });
    }
    drawText(g, 'Strzałki / mysz: wybór', GX, H - 56, C.dgray, SMALL);
    drawText(g, 'C / Esc: wróć', GX, H - 47, C.dgray, SMALL);
    button(r, 14, H - 26, 60, 16, 'Wróć');
    button(r, 80, H - 26, 90, 16, this.elems ? 'Szczegóły' : 'Żywioły [Tab]');
    panel(r, DX, 34, W - DX - 6, H - 40, C.gold);
    if (this.elems) { this.renderElements(r); return; }
    if (!this.count) return;
    this.sel = Math.min(this.sel, this.count - 1);
    if (this.sel < nw) this.renderWeapon(r, this.sel);
    else this.renderPassive(r, this.sel - nw);
  }

  private renderWeapon(r: Renderer, i: number): void {
    const g = r.g, run = this.run, w = run.weapons[i], d = w.def, base = weaponBase(d), x = DX + 10, tw = (W - DX - 26) / SMALL.scale;
    let y = 42;
    drawSprite(g, d.icon, x + 10, y + 10, { scale: 2 });
    drawText(g, d.name, x + 28, y, d.color, { shadow: C.black });
    const el = WEAPON_ELEMENT[d.id];
    drawText(g, `${d.fused ? 'Fuzja' : d.evolved ? 'Ewolucja' : `Poziom ${w.level}/${maxLevel(d)}`}${el ? `   ${ELEMENTS[el].name}` : ''}`, x + 28, y + 11, C.lavender);
    y += 26;
    const text = (s: string, col: number = C.lgray) => { for (const l of wrapText(s, tw)) { drawText(g, l, x, y, col, SMALL); y += 8.5; } };
    const head = (s: string, col: number) => { y += 3; drawText(g, s, x, y, col); y += 11; };
    text(d.desc, C.white);
    if (!d.evolved && w.level < maxLevel(d)) text(`Następny poziom: ${describeLevel(d, w.level + 1)}`);
    // Wierność broni: stopień i następny próg (tylko przy jednej broni).
    if (run.weapons.length === 1) {
      const L = BAL.loyal, lt = run.loyal, next = L.levels.find((l) => l > run.level);
      if (lt) text(`Wierność broni ${lt}: +${Math.round(lt * L.dmg * 100)}% obrażeń, +${Math.round(lt * L.atkSpeed * 100)}% szybkości ataku, +${lt * L.amount} pocisków.`, C.gold);
      if (next) text(`Tylko ta broń do poziomu ${next}: kolejny stopień Wierności broni.`, C.yellow);
    }
    const bonus = bonusLines(w.bonus);
    if (bonus.length) text(`Bonusy jakości: ${bonus.join(', ')}`, C.cyan);
    const augs = run.augments.filter((id) => augmentWorks(AUGMENT_BY_ID[id], d)).map((id) => AUGMENT_BY_ID[id].name);
    if (augs.length) text(`Augmenty: ${augs.join(', ')}`, C.cyan);
    // Hybryda: z czego powstała i które augmenty rodziców przepadły.
    const f = d.fused ? FUSIONS.find((x) => x.into === d.id) : undefined;
    if (f) {
      const lost = fusionAugments(d).lost.filter((a) => run.aug(a.id)).map((a) => a.name);
      head('Fuzja', C.pink);
      recipe(r, x, y, [WEAPON_BY_ID[f.a].icon, true], [WEAPON_BY_ID[f.b].icon, true], d.icon);
      drawText(g, `${WEAPON_BY_ID[f.a].name} +`, x + 86, y, C.white, SMALL);
      drawText(g, WEAPON_BY_ID[f.b].name, x + 86, y + 9, C.white, SMALL);
      y += 22;
      text(FUSION_RULES, C.dgray);
      if (lost.length) text(`Nie działają tu: ${lost.join(', ')} (inny typ ataku).`, C.salmon);
    }
    // Ewolucja: broń na maks. + pasywka.
    const evo = WEAPON_BY_ID[base]?.evolve;
    if (evo && !d.evolved) {
      const pas = PASSIVE_BY_ID[evo.passive], into = WEAPON_BY_ID[evo.into], maxed = w.level >= maxLevel(d), has = run.passives.some((p) => p.id === pas.id);
      head(`Ewolucja: ${into.name}`, C.yellow);
      recipe(r, x, y, [d.icon, maxed], [pas.icon, has], into.icon);
      drawText(g, maxed ? 'broń na maks.' : `broń: poziom ${maxLevel(d)}`, x + 86, y, maxed ? C.lime : C.lgray, SMALL);
      drawText(g, `${has ? 'masz' : 'brak'}: ${pas.name}`, x + 86, y + 9, has ? C.lime : C.salmon, SMALL);
      y += 22;
    }
    // Fuzje: z którą bronią można połączyć (obie na maks. albo po ewolucji).
    const fus = d.fused ? [] : FUSIONS.filter((f) => f.a === base || f.b === base);
    if (fus.length) {
      head('Fuzje', C.pink);
      const ready = (id: string) => run.weapons.find((v) => weaponBase(v.def) === id);
      const done = (v?: { def: { evolved?: boolean }; level: number; }, id?: string) => !!v && (v.def.evolved || v.level >= maxLevel(WEAPON_BY_ID[id!]));
      for (const f of fus) {
        if (y > H - 30) break;
        const other = f.a === base ? f.b : f.a, ow = ready(other), into = WEAPON_BY_ID[f.into];
        recipe(r, x, y, [d.icon, done(w, base)], [WEAPON_BY_ID[other].icon, done(ow, other)], into.icon);
        drawText(g, into.name, x + 86, y, C.white, SMALL);
        drawText(g, ow ? `masz: ${WEAPON_BY_ID[other].name}` : `brak: ${WEAPON_BY_ID[other].name}`, x + 86, y + 9, ow ? C.lime : C.salmon, SMALL);
        y += 22;
        const lost = fusionAugments(into).lost.filter((a) => run.aug(a.id)).map((a) => a.name);
        if (lost.length) text(`Przepadną: ${lost.join(', ')}`, C.salmon);
      }
    }
  }

  /** Żywioły i reakcje: stany, pary z opisem skutku; jasne są te, które twój build potrafi wywołać. */
  private renderElements(r: Renderer): void {
    const g = r.g, x = DX + 10, tw = (W - DX - 26) / SMALL.scale, own = new Set(buildElements(this.run));
    let y = 40;
    drawText(g, 'Żywioły', x, y, C.yellow);
    y += 11;
    for (const [el, desc] of STATES) {
      const d = ELEMENTS[el], a = own.has(el) ? 1 : 0.5;
      r.withAlpha(a, () => { drawText(g, d.name, x, y, d.color, SMALL); drawText(g, desc, x + 46, y, C.lgray, SMALL); });
      y += 8.5;
    }
    y += 4;
    drawText(g, 'Reakcje (drugi żywioł na wrogu)', x, y, C.yellow);
    y += 11;
    for (const re of reactions()) {
      const ok = own.has(re.a) && own.has(re.b);
      r.withAlpha(ok ? 1 : 0.5, () => {
        const A = ELEMENTS[re.a], B = ELEMENTS[re.b];
        let lx = x;
        drawText(g, re.name, lx, y, re.col, SMALL);
        lx += 62;
        drawText(g, A.name, lx, y, A.color, SMALL);
        drawText(g, '+', lx + 42, y, C.lgray, SMALL);
        drawText(g, B.name, lx + 49, y, B.color, SMALL);
        y += 8.5;
        for (const l of wrapText(re.desc, tw - 8)) { drawText(g, l, x + 6, y, C.lgray, SMALL); y += 8.5; }
      });
      y += 2;
    }
    for (const l of wrapText(`Jasne: twój build ma oba żywioły. Boss jest odporny na żywioł swojego biomu: stan się nie nakłada, obrażenia ${Math.round((1 - BAL.bossResist.mul) * 100)}% mniejsze.`, tw)) {
      drawText(g, l, x, y, C.dgray, SMALL); y += 8.5;
    }
  }

  private renderPassive(r: Renderer, i: number): void {
    const g = r.g, run = this.run, p = run.passives[i], d = PASSIVE_BY_ID[p.id], x = DX + 10, tw = (W - DX - 26) / SMALL.scale;
    let y = 42;
    drawSprite(g, d.icon, x + 10, y + 10, { scale: 2 });
    drawText(g, d.name, x + 28, y, C.lime, { shadow: C.black });
    drawText(g, `Poziom ${p.level}/${d.maxLevel}`, x + 28, y + 11, C.lavender);
    y += 26;
    for (const l of wrapText(`${d.desc} na każdy poziom.`, tw)) { drawText(g, l, x, y, C.white, SMALL); y += 8.5; }
    // Bronie, które ta pasywka ewoluuje (zielona ramka: masz tę broń).
    const evo = WEAPONS.filter((w) => w.evolve?.passive === p.id);
    if (!evo.length) return;
    y += 3;
    drawText(g, 'Potrzebna do ewolucji', x, y, C.yellow);
    y += 12;
    for (const w of evo) {
      if (y > H - 30) break;
      const own = run.weapons.find((v) => weaponBase(v.def) === w.id), into = WEAPON_BY_ID[w.evolve!.into];
      recipe(r, x, y, [w.icon, !!own && own.level >= maxLevel(w)], [d.icon, true], into.icon);
      drawText(g, into.name, x + 86, y, C.white, SMALL);
      drawText(g, own ? (own.def.evolved ? 'już ewoluowała' : `masz: ${w.name} (${own.level}/${maxLevel(w)})`) : `brak: ${w.name}`, x + 86, y + 9, own ? C.lime : C.salmon, SMALL);
      y += 22;
    }
  }
}
