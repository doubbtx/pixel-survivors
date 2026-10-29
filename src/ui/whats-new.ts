import { W, H } from '../core/renderer';
import { C } from '../core/palette';
import { drawText, wrapText, smallS } from '../core/font';
import { sfx } from '../core/audio';
import type { App, Screen } from './app';
import { panel, titleBar } from './widgets';
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
    version: '0.45',
    lines: [
      "Every hero now has a second ultimate to choose from: press R on the hero screen. Kestra: Falcon Shot, Borgun: Earthquake, Ignara: Solar Flare, Morwen: Plague, Vesper: Death Mark, Aurel: Bastion of Light, Takezo: Mushin. Your Progress upgrades and cards for the ultimate work with both.",
      "After a boss you gain at most 3 levels at once from the collected crystals (it used to be up to 27 level ups in a row).",
    ],
  },
  {
    version: '0.44',
    lines: [
      "After a boss the most important choices come first (relic, boss power, cards), then level ups, loot last. A counter in the corner shows how many rewards are left, and level ups in a row open faster.",
      "Loot: 'Take all to backpack' puts this item and the other regular items waiting in the queue into your backpack at once (uniques and legendaries still get their own window).",
      "Readability: only enemies you can see on screen shoot, there are fewer enemy bullets at once (each hits a bit harder), your own big explosions are half transparent and your hero is always drawn on top of your attacks.",
    ],
  },
  {
    version: '0.43.5',
    lines: [
      "Fixes from the second playtest: the Easy mode offer remembers defeats after reloading, Takezo's and Aurel's ability texts are fully translated, Y closes Synergies, situations, quests and events after the quiet start come one by one, DPS shows whole numbers.",
    ],
  },
  {
    version: '0.43.3',
    lines: [
      "Takezo's Flow (full Rhythm) now lasts until you take damage instead of a few seconds.",
    ],
  },
  {
    version: '0.43.2',
    lines: [
      "The first map of an Expedition is gentler: fewer enemies dealing less damage, a shorter goal, and no situations, quests or events in the first 90 seconds.",
      "After two early defeats in a row the end screen offers Easy mode with one button. The end screen says 'Your first records!' on a hero's first run.",
      "Smaller fixes: whole numbers for HP and gold, item totals read 'now', brighter 1-3 keys on cards, the pause menu says 'Tutorial' in the tutorial, map messages no longer cover the buttons.",
    ],
  },
  {
    version: '0.43',
    lines: [
      "Takezo's Rhythm builds faster and stays until you take damage; after a hit it drains to zero.",
      "In the pause menu (Build tab) click or point at a card to see what it does.",
      "Aurel has a new Q, Spear of Light, instead of Guardians: a spear that pierces a whole line of enemies and Brands them. Your hits on Branded enemies heal you, Hallowed Ground makes the Brand last longer and Guardian gives a shield for Branded enemies nearby. Your Aurel upgrades in Progress carry over to the spear.",
      "Takezo's Two Swords now cut like a whip: long horizontal slashes to the side you face, then to the other side.",
    ],
  },
  {
    version: '0.42',
    lines: [
      "Two new weapons for every hero: Blood Sickle (crescents that jump between enemies; evolves with Fang into Reaper's Moon, which heals you a little on every hit) and Dice (random damage, sixes hit harder and Luck rolls more of them; evolves with Horseshoe into Golden Six, whose sixes explode and drop coins). Both have a second evolution too (Hawk Eye, Clover).",
      "While choosing a level up, card, boss power, relic or loot you can look at your build (C), backpack (I) and synergies (Y), or click the buttons in the bottom left. You return to the same choice.",
      "Relics: after an Expedition act boss (and every second Endless boss) pick 1 of 3 relics. They last the whole run (max 3) and each changes a rule of the game with a real price, like the Blood Chalice: elite kills and broken situations heal, but meat no longer does.",
    ],
  },
  {
    version: '0.41',
    lines: [
      "Takezo has his own secret: Ganryū (parry 15 attacks in a row without getting hit).",
      "New elite traits from the second act on: Commander (nearby enemies get faster and stronger), Splitting (breaks into three on death), Bannerman (plants a banner: enemies inside heal, you take more damage) and Phasing (vanishes for a moment, your shots pass through, then reappears closer).",
      "Takezo: his swords reach further (larger area).",
    ],
  },
  {
    version: '0.40',
    lines: [
      "Readability: enemy bullets are drawn above your hits and explosions, and the new automatic setting for your attacks dims them (and damage numbers) when many enemy bullets are close to you.",
      "Expedition survival maps also end once you defeat as many enemies as a kill map asks for, so strong builds finish them faster.",
      "Long boss fights: after 90 seconds a boss weakens and takes more and more damage (up to double).",
      "Heroes: Ignara +10 max HP, Borgun +15% damage, Takezo +8% damage.",
    ],
  },
  {
    version: '0.39',
    lines: [
      "Situations: every minute or so enemies arrive in a formation that asks for a specific answer: a shield wall with shooters behind it, crossfire from four sides, a kamikaze swarm, a ritual of summoners, and one per biome (a stampede, attackers from below, a desert ambush, a mirror dance). A 2-second warning shows where they come from.",
      "Break a formation for a handful of gold; kill both ritual summoners within 20 seconds for an elite chest.",
    ],
  },
  {
    version: '0.38',
    lines: [
      "Expedition maps can be weak to an element (+50% damage from it) or resist one (-50%, its statuses blocked, more loot). The map panel shows your build's element mix from the last map, so you can pick a route that suits it.",
      "Elite maps and ambushes show their elite traits in advance (one trait in act 1, two later).",
      "Automatic quality: when frames get slow, the world is drawn at a lower resolution until the game runs smoothly again.",
    ],
  },
  {
    version: '0.37',
    lines: [
      "New Expedition nodes: Ambush (survive while rings of enemies close in, the last ones with elites), Hunt (kill the biome miniboss and its escort before it escapes, for a boss chest) and Vault (an arena with wardens and treasure).",
      "Balance: elite maps drop a chest from every second elite, dungeons give half the modifier reward, survival maps are shorter and act bosses are tougher.",
      "Fixed a rare softlock where enemies stopped appearing after a boss was pushed out by a full crowd.",
    ],
  },
  {
    version: '0.36',
    lines: [
      "Enemy toughness rewards strong builds: enemies grow with your level and follow your damage only gently, so a much stronger build clears noticeably faster. Fewer damage sponges, steadier difficulty, smaller crowds.",
    ],
  },
  {
    version: '0.35',
    lines: [
      "Enemy damage no longer grows with how strong your build is: it depends on depth and on time spent at that depth, gently in the first minutes.",
      "Expedition map: point at any later node (or press R/X once the act has started) to preview it and highlight every path to it. Maps with a bonus show a green +.",
      "Camps and shrines now offer two bonuses to choose from instead of a random one. Dungeons do not use up camp bonuses.",
      "Difficulty is set before the first node of each act and stays for the whole act. Every lane can now reach a camp or shop before the boss.",
    ],
  },
  {
    version: '0.34',
    lines: [
      "Every weapon type has its own sound (arrows, knives, fire, souls, lightning, beams, blades and more), with slight pitch variations so repeated hits don't sound the same.",
      "Music: its own theme for the menu, every biome (scale, tempo, rhythm, instruments) and a boss theme. Important sounds (boss, evolution, level up, chest) briefly lower the music, and a voice limit keeps crowds from drowning them out.",
    ],
  },
  {
    version: '0.33',
    lines: [
      "Bosses: a third attack in every phase (12 new attacks) and clearer warnings: the attack name appears above the boss, with an aiming line, a ring around the boss or a closing circle under you.",
      "More power: critical hits crack, flash and show '!' (double crits '!!'), evolutions and fusions pause the game for a moment with a fanfare, elite kills and Lucky finds stand out, kill streaks call out Rampage, Massacre, Carnage and Annihilation.",
      "Run summary: a new Highlights tab with the best weapon, peak DPS, biggest hit, longest combo and best kill streak, plus the hero records you broke.",
    ],
  },
  {
    version: '0.32',
    lines: [
      "New hero Takezo, a swordsman with two swords inspired by Miyamoto Musashi. Q Helm Splitter: an overhead strike into a spot in front of you. E Thousand Cuts: slashes in a cone, more of them with attack speed. R Iai: dash, sheathe, and everything on the path is cut.",
      "Takezo's Rhythm: every hit stacks attack speed, it fades out of combat and Iai spends it for a stronger cut. Passive Mikiri: a chance to parry hits and projectiles that grows with your level (parried projectiles fly back). Unlock: win an Expedition with Borgun or Vesper.",
      "Polish: English names inside Polish texts are translated too.",
    ],
  },
  {
    version: '0.31',
    lines: [
      "Every passive now evolves at least two weapons: 20 new weapon evolutions, each a variant of the weapon's evolution with its own profile (homing, splitting, bursting, more or heavier attacks). With several passives you choose the evolution.",
      "Passive evolutions: a passive at max level evolves once you evolved a weapon with it (gold star icon, extra bonus).",
      "New passives: Ember (elemental power) and Whetstone (critical damage).",
      "Level up cards, the build view and the Arsenal show what each passive evolves. New Evolution book in the main menu: all weapon, passive and ability evolutions, fusions, qualities and augments, and how to get them.",
    ],
  },
  {
    version: '0.30',
    lines: [
      "New enemies in every biome, each with its own attack and a warning before it: Boar (charge line), Thornling (seeds into marked circles), Bog Toad (leaps, landing shadow), Drowner (hides under the mud, ripples), Salamander (flame cone), Scorpion (sniper line), Splitter (splits in two) and Reflection (slices across your path).",
      "Biome minibosses with their own attacks: Boar King, Toad Matriarch, Sand Tyrant, Shattered Knight and Void Prism. One appears on every Expedition elite map and from time to time in Endless. They drop an elite chest.",
      "All new enemies and minibosses have Bestiary entries.",
      "Expedition camp (Rest) also gives a random bonus for the next fight: damage, attack speed, HP, experience and gold, or speed.",
      "Glows, shadows and the vignette are gone for a cleaner picture (the Effects option was removed). Icons were straightened and centered.",
      "Fixed: four item icons lost in 0.29.3 (ring, greaves, band, charm) no longer stop the game.",
    ],
  },
  {
    version: '0.29',
    lines: [
      'Text size option (Settings, Readability): Large shows descriptions at full size; long texts scroll (mouse wheel, drag, PageUp / PageDown, right stick).',
      'Reduce flashing option and a photosensitivity warning on first launch.',
      'Change your keys in Settings, General, Controls. Ability keys in the HUD and tutorial follow your choice.',
      'Gamepad: map difficulty on LB / RB, forge options with up / down and RB, RT opens weapons and passives.',
      'Expedition map: clicking a node only selects it. Start with Travel or Enter.',
    ],
  },
  {
    version: '0.28',
    lines: [
      'New players start with a short interactive tutorial (skip it in the pause menu, replay it in Settings).',
      'Gradual unlocks: new players begin with the Expedition and two heroes. Bosses, acts and wins unlock the Anvil, heroes, Endless, Pacts and harder map difficulties.',
      'Your current save keeps everything unlocked.',
      'Collection tabs appear once they have something in them.',
    ],
  },
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
    titleBar(r, "What's new", 12);
    panel(r, x, 42, w, H - 76);
    let y = 52;
    // Starsza wersja tylko wtedy, gdy zmieści się cała w ramce (nowsza zawsze).
    const height = (n: { lines: string[] }) => 20 + n.lines.reduce((h, l) => h + wrapText(l, w - 34).length * 11 + 3, 0);
    for (const n of this.notes) {
      if (n !== this.notes[0] && y + height(n) > H - 38) break;
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
    if (this.t > 0.3) drawText(g, 'Press any key or tap to continue', W / 2, H - 24, C.lavender, { align: 'center', scale: smallS() });
  }
}
