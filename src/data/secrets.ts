import { C } from '../core/palette';
import { ELEM, WEAPON_ELEMENT } from './elements';
import { CARD_BY_ID, type CardHooks } from './cards';
import type { Stats } from '../entities/types';
import type { Run } from '../game/run';

/**
 * Księga sekretów: ukryte buildy. Gdy warunek `check` jest spełniony (systems/secrets.ts sprawdza co 0,5 s), sekret
 * budzi się do końca runu (`while` = tylko dopóki warunek trwa) i trafia do kolekcji (`save.collection.secrets`).
 * Efekt jak u kart: `stats`, `flags`, `hooks` (stosy = 1). Nieodkryty sekret w Księdze pokazuje tylko zagadkę.
 * Liczniki warunków w `run.cardState['sec.*']` (zasoby, sługi) — ustawiane w systemach.
 */
export interface SecretDef {
  id: string;
  name: string;
  riddle: string;
  desc: string;
  hero?: string;
  /** Działa tylko, dopóki warunek jest spełniony. */
  while?: boolean;
  check: (run: Run) => boolean;
  stats?: Partial<Stats>;
  flags?: Record<string, number>;
  hooks?: CardHooks;
}

/** Liczba źródeł danego żywiołu w buildzie (bronie, augmenty, karty i przedmioty). */
function elemSources(run: Run, el: string): number {
  let n = run.weapons.filter((w) => WEAPON_ELEMENT[w.def.id] === el).length;
  for (const e of run.augElem.values()) if (e === el) n++;
  if (run.flag(`elemChance.${el}`) > 0) n++;
  return n;
}

const cursedCards = (run: Run) => run.cards.filter((c) => CARD_BY_ID[c.id].cursed).reduce((n, c) => n + c.stacks, 0);

export const SECRETS: SecretDef[] = [
  {
    id: 'plague', name: 'Wieczna Zaraza', riddle: 'Gdy jad przepełni ciało, a źródeł jadu będzie wiele...',
    desc: 'Zatruci wrogowie po śmierci zarażają wszystkich w pobliżu pełną trucizną.',
    check: (run) => elemSources(run, 'poison') >= 2 && run.enemies.items.some((e) => !e.dead && e.poisonStacks >= ELEM.poisonMaxStacks - 2),
    hooks: {
      onKill: (run, e) => {
        if (e.poisonStacks <= 0) return;
        run.enemiesInCircle(e.x, e.y, 45, (o) => { for (let i = 0; i < 3; i++) run.applyElement(o, 'poison', e.poisonUnit / ELEM.poisonRatio); });
        run.burst(e.x, e.y, C.lime, 8, 50);
      },
    },
  },
  {
    id: 'phoenix', name: 'Feniks', riddle: 'Tylko ogień w twoich dłoniach, i to niejeden.',
    desc: 'Raz na poziom odradzasz się po śmierci, a ogień jest o 30% silniejszy.',
    check: (run) => run.weapons.length >= 2 && run.weapons.every((w) => WEAPON_ELEMENT[w.def.id] === 'fire'),
    flags: { revive: 1 }, stats: { elemPower: 0.3 },
  },
  {
    id: 'prism', name: 'Pryzmat', riddle: 'Cztery żywioły w jednych rękach.',
    desc: 'Reakcje żywiołów o 50% silniejsze i odnawiają się szybciej.',
    check: (run) => ['fire', 'ice', 'lightning', 'poison'].every((el) => elemSources(run, el) > 0),
    flags: { reactPower: 0.5, reactCd: 0.3 },
  },
  {
    id: 'demon', name: 'Pakt z demonem', riddle: 'Trzy klątwy przyjęte z własnej woli.',
    desc: '+30% obrażeń i +10% krytyka.',
    check: (run) => cursedCards(run) >= 3,
    stats: { might: 0.3, crit: 0.1 },
  },
  {
    id: 'ascetic', name: 'Asceta', riddle: 'Silny bez niczego. Drugi poziom kampanii, dwudziesty postaci, gołe ręce.', while: true,
    desc: 'Dopóki nie nosisz żadnego przedmiotu: +60% obrażeń, +5 pancerza, +2 HP/s.',
    check: (run) => run.level >= 20 && run.depth >= 2 && Object.values(run.equipment).every((it) => !it),
    stats: { might: 0.6, armor: 5, regen: 2 },
  },
  {
    id: 'glass', name: 'Szklane działo', riddle: 'Pewny każdego ciosu, choć ledwo żywy.',
    desc: 'Krytyk ponad 100% może trafić podwójnie, +50% obrażeń krytycznych.',
    check: (run) => run.stats.crit >= 1 && run.player.hp < run.stats.maxHp * 0.3,
    flags: { overcrit: 1 }, stats: { critMult: 0.5 },
  },
  {
    id: 'pacifist', name: 'Pacyfista', riddle: 'Pierwsza minuta bez rozlewu krwi.',
    desc: 'Następny pokonany boss upuści unikat.',
    check: (run) => run.time >= 60 && run.levelKills === 0 && !run.dungeon,
  },
  {
    id: 'necro', name: 'Nekromanta', riddle: 'Armia większa niż kiedykolwiek.', hero: 'morwen',
    desc: 'Sługi zadają +50% obrażeń i żyją 50% dłużej.',
    check: (run) => run.minions.count >= 25,
    flags: { minionDmg: 0.5, minionLife: 0.5 },
  },
  {
    id: 'falcon', name: 'Sokół i kruk', riddle: 'Pięćdziesiąt celnych strzałów z daleka, bez jednej rany.', hero: 'kestra',
    desc: 'Oberwanie nie zabiera już Celności.',
    check: (run) => (run.cardState['sec.falcon'] ?? 0) >= 50,
    flags: { focusKeep: 1 },
  },
  {
    id: 'berserk', name: 'Berserk', riddle: 'Trzy razy wpaść w szał na jednym poziomie.', hero: 'borgun',
    desc: 'Furia nie opada poza walką, Szał trwa o połowę dłużej, +15% obrażeń.',
    check: (run) => (run.cardState['sec.berserk'] ?? 0) >= 3,
    flags: { furyHold: 1 }, stats: { might: 0.15 },
  },
  {
    id: 'pyre', name: 'Wieczny płomień', riddle: 'Płoń dziesięć sekund ponad miarę.', hero: 'ignara',
    desc: 'Przegrzanie już nie rani, a czary w żarze są jeszcze silniejsze.',
    check: (run) => (run.cardState['sec.pyre'] ?? 0) >= 10,
    flags: { 'heat.safe': 1, 'res.power': 0.3 },
  },
  {
    id: 'shadowqueen', name: 'Królowa cieni', riddle: 'Jeden cios, dwadzieścia trupów.', hero: 'vesper',
    desc: 'Egzekucja zostawia połowę kombo, +10% szansy na krytyk.',
    check: (run) => (run.cardState['sec.exec'] ?? 0) >= 20,
    flags: { execKeep: 0.5 }, stats: { crit: 0.1 },
  },
  {
    id: 'saint', name: 'Święty', riddle: 'Dwunastu strażników i ani jednej rany na duszy.', hero: 'aurel',
    desc: 'Sługi żyją 30% dłużej, +1.5 HP na sekundę.',
    check: (run) => run.minions.count >= 12 && run.player.hp >= run.stats.maxHp * 0.95,
    flags: { minionLife: 0.3 }, stats: { regen: 1.5 },
  },
];

export const SECRET_BY_ID: Record<string, SecretDef> = Object.fromEntries(SECRETS.map((s) => [s.id, s]));

/** Pacyfista: znacznik w stanie kart — następny boss upuszcza unikat. */
export const PACIFIST_KEY = 'sec.pacifist';
