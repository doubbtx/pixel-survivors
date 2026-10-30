import { W, H, type Renderer } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText, DESC, descS, descLH, smallS } from '../core/font';
import { sfx } from '../core/audio';
import { drawSprite } from '../gfx/sprites';
import { BAL } from '../data/balance';
import { WEAPONS, WEAPON_BY_ID, FUSIONS, maxLevel, evolvesOf } from '../data/weapons';
import { PASSIVES, PASSIVE_BY_ID } from '../data/passives';
import { HEROES, HERO_BY_ID } from '../data/heroes';
import { AUGMENTS, FUSION_RULES } from '../data/augments';
import { RARITIES } from '../data/items';
import { ELEMENTS, WEAPON_ELEMENT } from '../data/elements';
import { passiveEvolves } from '../systems/levelup';
import type { App, Screen } from './app';
import { button, backButton, backHit, panel, slot, inside, Scroll, titleBar } from './widgets';

/** Wpis księgi: przepis z ikon (składniki → wynik), tytuł, sposób zdobycia i opis. */
interface Entry {
  parts: string[];
  result: string;
  title: string;
  color: number;
  how: string;
  desc: string;
}

/** Strona księgi: tytuł zakładki, wstęp i wpisy. */
interface Page {
  title: string;
  intro: string;
  entries: Entry[];
}

const heroNote = (hero?: string) => (hero ? ` Only ${HERO_BY_ID[hero].name}.` : '');

function weaponPage(): Page {
  const entries: Entry[] = [];
  for (const w of WEAPONS) {
    if (w.evolved) continue;
    for (const e of evolvesOf(w)) {
      const into = WEAPON_BY_ID[e.into], pa = PASSIVE_BY_ID[e.passive], el = WEAPON_ELEMENT[into.id];
      entries.push({
        parts: [w.icon, pa.icon], result: into.icon, title: into.name, color: into.color,
        how: `${w.name} at level ${maxLevel(w)} + passive ${pa.name}, then level up.${heroNote(w.hero)}`,
        desc: `${into.desc}${el ? ` Element: ${ELEMENTS[el].name}.` : ''}`,
      });
    }
  }
  return { title: 'Weapons', intro: 'Every weapon evolves with several passives, each into a different weapon. You choose one evolution; the weapon level resets and quality bonuses stay.', entries };
}

function passivePage(): Page {
  const entries = PASSIVES.map((p): Entry => {
    const ws = passiveEvolves(p.id);
    return {
      parts: [p.icon, ...(ws[0] ? [ws[0].into.icon] : [])], result: `${p.icon}_evo`, title: p.evo.name, color: C.gold,
      how: `${p.name} at level ${p.maxLevel} + one weapon evolved with it (${ws.map((x) => x.into.name).join(', ')}), then level up.`,
      desc: `${p.desc} per level. Evolution: ${p.evo.desc}.`,
    };
  });
  return { title: 'Passives', intro: 'Passives evolve too: max level plus a weapon you evolved with that passive. The evolved passive keeps its levels and adds a bonus.', entries };
}

function fusionPage(): Page {
  const entries = FUSIONS.map((f): Entry => {
    const a = WEAPON_BY_ID[f.a], b = WEAPON_BY_ID[f.b], into = WEAPON_BY_ID[f.into];
    return {
      parts: [a.icon, b.icon], result: into.icon, title: into.name, color: into.color,
      how: `${a.name} + ${b.name}, both at max level or evolved, then level up.${heroNote(a.hero ?? b.hero)}`,
      desc: into.desc,
    };
  });
  return { title: 'Fusions', intro: FUSION_RULES, entries };
}

function abilityPage(): Page {
  const entries: Entry[] = [];
  for (const h of HEROES) {
    for (const a of [...h.abilities, ...(h.altUlt ? [h.altUlt] : [])]) {
      if (!a.evo) continue;
      entries.push({
        parts: [a.icon, `tag:${a.evo.tag}`], result: a.evo.icon, title: `${a.evo.name} (${h.name})`, color: h.color,
        how: `${a.name} at level ${a.maxLevel} + active ${a.evo.tag} synergy, then level up.`,
        desc: a.evo.desc,
      });
    }
  }
  return { title: 'Abilities', intro: 'Hero abilities evolve at max level while the synergy shown in their description is active (gather its tags from weapons, passives, cards and items).', entries };
}

function upgradePage(): Page {
  const Q = BAL.weaponQuality;
  const entries: Entry[] = RARITIES.map((r, q): Entry => ({
    parts: [], result: 'sh_upgrade', title: r.name.pl, color: r.color,
    how: q ? `+${q} bonus on a weapon level up (chance ${Q.weights[q]}%, Luck raises it).` : `Weapon level only (chance ${Q.weights[0]}%).`,
    desc: q >= Q.amountFrom ? 'Bonuses: damage, attack speed, area, critical chance, projectile speed, elemental power or +1 projectile.' : 'Bonuses: damage, attack speed, area, critical chance, projectile speed or elemental power.',
  }));
  for (const a of AUGMENTS) {
    const w = WEAPON_BY_ID[a.weapon];
    entries.push({
      parts: [w.icon], result: 'cd_echo', title: a.name, color: C.cyan,
      how: `Augment of ${w.name}: offered from weapon level ${BAL.augmentMinLevel} (or after evolution).`,
      desc: `${a.desc}${a.elem ? ` Element: ${ELEMENTS[a.elem].name}.` : ''}`,
    });
  }
  return { title: 'Upgrades', intro: 'Weapon level ups roll a quality (Common to Legendary) with extra bonuses that stay through evolution and fusion. Augments change how one weapon attacks.', entries };
}

const PAGES: Page[] = [weaponPage(), passivePage(), fusionPage(), abilityPage(), upgradePage()];
const AREA = [12, 54, W - 24, H - 84] as const;
const TAB_W = Math.floor((W - 20) / PAGES.length) - 3;
const S = 18;

/**
 * Księga ewolucji (menu główne, 0.31): wszystkie ewolucje broni (każda pasywka ewoluuje kilka broni), ewolucje pasywek,
 * fuzje, ewolucje umiejętności oraz ulepszenia (jakość, augmenty) — każdy wpis jako przepis z ikon i opis, jak go zdobyć.
 * Lewo/prawo albo klik w zakładkę: strona; góra/dół, kółko, PageUp/PageDown: przewijanie; Esc: wróć.
 */
export class CodexScreen implements Screen {
  private page = 0;
  private scroll = new Scroll();

  constructor(private readonly app: App, private readonly back: Screen) {}

  private tabX(i: number): number {
    return 10 + i * (TAB_W + 3);
  }

  update(): void {
    const inp = this.app.input, n = PAGES.length;
    if (inp.pressed('back') || inp.pressed('pause') || backHit(inp)) { this.app.go(this.back); return; }
    this.scroll.update(inp, ...AREA, true);
    const before = this.page;
    if (inp.pressed('left')) { this.page = (this.page - 1 + n) % n; sfx.play('select'); }
    if (inp.pressed('right') || inp.pressed('confirm') || inp.pressed('inventory')) { this.page = (this.page + 1) % n; sfx.play('select'); }
    if (inp.pressed('click')) {
      PAGES.forEach((_, i) => { if (inside(inp.mouse.x, inp.mouse.y, this.tabX(i), 30, TAB_W, 16)) { this.page = i; sfx.play('select'); } });
    }
    if (this.page !== before) this.scroll.reset();
  }

  /** Przepis: ikony składników z „+” i „>”, wynik w złotej ramce; zwraca szerokość. */
  private recipe(r: Renderer, e: Entry, x: number, y: number): number {
    let cx = x;
    e.parts.forEach((icon, i) => {
      slot(r, cx, y, S, C.slate);
      drawSprite(r.g, icon, cx + S / 2, y + S / 2);
      cx += S;
      drawText(r.g, i < e.parts.length - 1 ? '+' : '>', cx + 4, y + 5, i < e.parts.length - 1 ? C.lgray : C.yellow, { align: 'center', outline: C.black });
      cx += 8;
    });
    slot(r, cx, y, S, C.gold);
    drawSprite(r.g, e.result, cx + S / 2, y + S / 2);
    return 3 * S + 2 * 8;
  }

  render(): void {
    const r = this.app.r, g = r.g, pg = PAGES[this.page];
    r.clear(C.black);
    titleBar(r, 'Evolution book', 6);
    PAGES.forEach((p, i) => button(r, this.tabX(i), 30, TAB_W, 16, `${p.title} (${p.entries.length})`, { active: i === this.page, accent: C.gold }));
    panel(r, 10, 52, W - 20, H - 80);
    const oy = this.scroll.begin(r, ...AREA), x = 20, tx = x + 3 * S + 2 * 8 + 8, tw = (W - tx - 20) / descS(), lh = descLH();
    let y = 60 - oy;
    for (const l of wrapText(pg.intro, (W - 44) / descS())) { drawText(g, l, x, y, C.lavender, DESC); y += lh; }
    y += 6;
    for (const e of pg.entries) {
      // Rysuje tylko widoczne wpisy (długie strony), ale zawsze liczy wysokość.
      const how = wrapText(e.how, tw), desc = wrapText(e.desc, tw), h = Math.max(S + 4, 11 + (how.length + desc.length) * lh + 4);
      if (y + h > AREA[1] - 4 && y < AREA[1] + AREA[3] + 4) {
        this.recipe(r, e, x, y);
        drawText(g, e.title, tx, y, e.color, { shadow: C.black });
        let ly = y + 11;
        for (const l of how) { drawText(g, l, tx, ly, C.lime, DESC); ly += lh; }
        for (const l of desc) { drawText(g, l, tx, ly, C.lgray, DESC); ly += lh; }
        r.withAlpha(0.3, () => r.rect(x, y + h - 2, W - 44, 1, C.slate));
      }
      y += h + 2;
    }
    this.scroll.end(r, y + oy - AREA[1], ...AREA);
    backButton(r);
    drawText(g, '< > page   up/down scroll', W - 14, H - 18, C.lavender, { align: 'right', scale: smallS() });
  }
}
