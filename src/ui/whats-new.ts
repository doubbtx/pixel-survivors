import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText } from '../core/font';
import { sfx } from '../core/audio';
import type { App, Screen } from './app';
import { panel } from './widgets';
import { MainMenu } from './menus';

/** Bieżąca wersja w postaci major.minor (poprawki x.y.z nie pokazują ekranu nowości). */
export const VERSION_KEY = __APP_VERSION__.split('.').slice(0, 2).join('.');

/** Porównanie wersji major.minor liczbowo („0.3” < „0.27”). */
function newer(a: string, b: string): boolean {
  const [a1, a2] = a.split('.').map(Number), [b1, b2] = b.split('.').map(Number);
  return a1 !== b1 ? a1 > b1 : a2 > (b2 || 0);
}

/** Nowości wersji (po angielsku; polski w core/i18n-pl.ts). Najnowsza na górze. */
const NOTES: { version: string; lines: string[] }[] = [
  {
    version: '0.27',
    lines: [
      'Two modes stay: Expedition and Endless. Hardcore, Training, Quick run, Boss rush and the Daily challenge are gone.',
      'Progression now works in Endless too, and Endless gives essence based on how long you survive.',
      'The Void also opens in Endless (Pact 5+ or 20 minutes). Ascetic and Flawless moved to Expedition and Endless.',
      'The Wayfarer achievement (finish act 1 of an Expedition) replaces the Daily one.',
      'Polish translation now works both ways.',
    ],
  },
];

/** Czy pokazać nowości: zapis z wcześniejszej wersji, w której gracz ich nie widział (nowa gra: od razu oznaczone). */
export function pendingNews(app: App): boolean {
  const s = app.save;
  if (!s.seenVersion) { s.seenVersion = VERSION_KEY; app.persist(); return false; }
  return s.seenVersion !== VERSION_KEY && NOTES.some((n) => newer(n.version, s.seenVersion));
}

/** Ekran „What's new” po aktualizacji: raz, zamykany dowolnym klawiszem, przyciskiem albo dotknięciem. */
export class WhatsNewScreen implements Screen {
  private t = 0;
  private readonly notes: { version: string; lines: string[] }[];

  constructor(private readonly app: App) {
    this.notes = NOTES.filter((n) => newer(n.version, app.save.seenVersion)).slice(0, 2);
  }

  update(dt: number): void {
    this.t += dt;
    // Krótka blokada, żeby klawisz wciśnięty jeszcze przed ekranem go nie zamknął.
    if (this.t < 0.3 || !this.app.input.anyPressed()) return;
    this.app.save.seenVersion = VERSION_KEY;
    this.app.persist();
    sfx.play('select');
    this.app.go(new MainMenu(this.app));
  }

  render(): void {
    const r = this.app.r, g = r.g;
    r.clear(C.black);
    const x = 40, w = W - 80;
    drawText(g, "What's new", W / 2, 12, C.yellow, { align: 'center', scale: 2, outline: C.black });
    panel(r, x, 42, w, H - 76, C.gold);
    let y = 52;
    for (const n of this.notes) {
      drawText(g, `Version ${n.version}`, x + 12, y, C.gold);
      y += 14;
      for (const l of n.lines) {
        wrapText(l, w - 34).forEach((line, i) => {
          if (i === 0) drawText(g, '-', x + 14, y, C.gold);
          drawText(g, line, x + 22, y, C.white);
          y += 11;
        });
        y += 3;
      }
      y += 6;
    }
    if (this.t > 0.3) drawText(g, 'Press any key or tap to continue', W / 2, H - 24, C.lavender, { align: 'center', scale: 0.75 });
  }
}
