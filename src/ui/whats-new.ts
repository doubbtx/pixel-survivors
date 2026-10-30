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
    version: '0.62',
    lines: [
      "When you die, the end screen says what killed you and has a Damage taken tab. Very fast bursts of damage are softened, so you get a moment to react, but standing still is still deadly. Keys you mash in combat (dodge, ultimate) no longer pick cards or skip the end screen.",
      "Easier start: on Common and Magic the first maps of act 1 ramp up gently (fewer shooters and bullets, some HP back after each map), and your first discoveries come after one or two runs. Enemy bullets are drawn on top with a bright rim, bosses flash less, and level-up cards explain why they are Recommended.",
      "Nightmare and Torment: strong builds must keep moving. Very strong builds face tougher enemies, and Takezo's katana covers at most 3 rows of cuts.",
    ],
  },
  {
    version: '0.61',
    lines: [
      "Weapons now have roles: single target (great on bosses and elites, aims at them first), crowd (clears hordes, weak on bosses) and hybrid. Go all in on one and suffer on the other side, or mix. The role is shown on level-up cards and in the weapon details.",
      "New players start with part of the weapons, passives and cards; the rest unlocks through play (defeat a boss, reach a level, trigger reactions...). Every finished run also brings you closer to the next discovery. Locked things show how to get them in the Codex and the Collection. If you already played, everything stays unlocked.",
    ],
  },
  {
    version: '0.60',
    lines: [
      "Balance: standing still is no longer safe. Kill explosions, reactions and chain effects no longer crit a second time or set off more explosions, so enemies stop dying off-screen. Lifesteal heals at most 4% of your max HP per second, ranged enemies fire as soon as they are in range, and late acts keep getting harder.",
      "The end screen shows every card, damage source and record (scroll, point or tap an icon for details), and the DPS chart uses a log scale. Phoenix no longer kills elites and minibosses.",
    ],
  },
  {
    version: '0.59',
    lines: [
      "A single hit can take at most 40% of your max HP (more on Torment): glass-cannon builds still hurt, but a boss no longer kills you in one frame. Phoenix and other revives now give 3 s of invulnerability, wipe the enemies around you and clear nearby bullets; the end screen shows revives used on the map.",
      "Phone: no keyboard labels on touch, Backpack and Build buttons next to pause, the same Back button in the top-left of every screen, a HUD size option (Settings > Readability), button names on touch ability slots. With auto-equip on, common and magic loot goes straight to the backpack with one message.",
      "Torment now changes rules: short warnings, no breathers, elites explode into bullets, one fewer level-up option. Auto-equip prefers area and duration for melee builds and never takes off items with a super bonus or uniques. Ult cards only show up for the ultimate you picked. Plus 26 smaller fixes from the code review.",
    ],
  },
  {
    version: '0.58',
    lines: [
      "Big bug-fix pass (code review by a team of agents): a crash when a boss died from your own hit chain, portals during a boss fight, Plague and Mushin fixes, lost loot and revives after resuming, many touch fixes (backpack, shop, map preview, relic swap, double-tap confirmations), keyboard selection no longer stolen by a resting mouse, translations, fire zones from Spark no longer multiply endlessly, and smoother frames with many enemies.",
    ],
  },
  {
    version: '0.57',
    lines: [
      "Scripted maps (prototype, Expedition act 1): every fight has a plan shown on the map (Prologue, Charge, Barrage). Instead of random situations you get planned moments: swarms, charges from several sides, a tough elite, a firing line, fire raining on the ground and a short moment of calm. Tell us how it plays!",
    ],
  },
  {
    version: '0.55',
    lines: [
      "Auto-equip is smarter: it compares stats at the same item level (damage is no longer pushed out by HP late in a run), it only swaps for a clearly better new item (forged items get extra margin), it never puts on uniques or items you took off yourself, and a message tells you what was swapped.",
    ],
  },
  {
    version: '0.53',
    lines: [
      "Best gear: after every loot your best items are equipped automatically (Settings > General, on by default), and the Best gear [R] button in the backpack does it on demand. Uniques and super bonuses count extra, so they are not swapped out for small gains.",
    ],
  },
  {
    version: '0.51',
    lines: [
      "New defaults for readability: your own attacks are dimmed and the camera is set to far (if you never changed these settings). In the late game you can hide your attacks completely in Settings > Readability: they still work.",
    ],
  },
  {
    version: '0.50',
    lines: [
      "Takezo: getting hit no longer drains Rhythm while it builds. Only a hit during Flow (full bar) breaks it, then it drains to zero.",
    ],
  },
  {
    version: '0.49',
    lines: [
      "Melee and pressure: Holy Aura and Orbit Blades reach further, shooters keep a shorter distance and step closer after a volley, and from minute 3 more kamikazes, blinkers and weavers come for you (plus rings of fast enemies every minute after 4:30). Standing still with ranged weapons is riskier now.",
      "Battle trance: with 3 or more enemies right next to you the ring turns turquoise and you take 15% less damage; close kills heal you a little.",
    ],
  },
  {
    version: '0.48',
    lines: [
      "Phone and touch: the ultimate switch and skin are buttons on the hero screen, boss power has a Skip button, Pacts have Reset, a tap cancels key binding, and in the shop, backpack, Progression and cards the first tap shows the description, the second one buys or picks. Tap later map nodes to preview them.",
      "Act 1 map 2 is a bit gentler, Torment rules also show when you pick with the keyboard and the essence counter includes the Torment bonus. The close combat ring is white now. Fewer damage numbers and explosions in huge crowds, a brighter Solar Flare.",
    ],
  },
  {
    version: '0.47',
    lines: [
      "Weapon balance: melee weapons (Holy Aura, Orbit Blades, axe, katana, Holy Light, Mines) hit harder and wider, Chain Lightning is a bit weaker and homing weapons pick targets a little closer. New: hits on enemies right next to you deal +20% damage (a white ring shows it).",
    ],
  },
  {
    version: '0.46',
    lines: [
      "Torment: levels above Nightmare for experienced players. Win an Expedition on Nightmare to open Torment 1, then each win opens the next (up to 10). Press T on the map before the first fight; every level adds one rule and more essence.",
      "Clearer late game: Earthquake, Solar Flare and Death Mark show a visible area, crowds over 500 enemies skip the white hit flash and enemy bullets are capped (except bosses). After the tutorial you land in the main menu.",
    ],
  },
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
