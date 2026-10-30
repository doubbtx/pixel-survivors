import { EN } from './i18n-en';
import { PL } from './i18n-pl';

/**
 * Język gry. Teksty w kodzie są po polsku; przy angielskim core/font.ts tłumaczy każdy rysowany napis (`tr`):
 *  1. dokładne dopasowanie w słowniku (także po małych literach: nazwy z `toLowerCase()`),
 *  2. wzorce z `{}` (np. "Poziom {}"), wstawki tłumaczone rekurencyjnie,
 *  3. podział na kawałki po separatorach (`SEPS`, od podwójnych spacji do przecinków) i tłumaczenie każdego,
 *  4. słowo po słowie, gdy każde słowo jest w słowniku (nazwy przedmiotów: przymiotnik + typ + "of X").
 * Wyniki trafiają do pamięci podręcznej (czyszczonej po CACHE_MAX wpisach).
 * Od 0.27 nowe napisy pisane są po angielsku: słownik `core/i18n-pl.ts` (EN → PL, dokładnie i wzorce `{}`) tłumaczy je
 * na polski, a w trybie angielskim zostają bez zmian.
 */
export type Lang = 'en' | 'pl';

let lang: Lang = 'en';
const cache = new Map<string, string>();
const CACHE_MAX = 6000;

export function setLang(l: Lang): void {
  lang = l;
  cache.clear();
}

export const getLang = (): Lang => lang;

const EXACT = new Map<string, string>();
const LOWER = new Map<string, string>();
const PATTERNS: { re: RegExp; out: string; lit: number }[] = [];
for (const [k, v] of Object.entries(EN)) {
  if (!k.includes('{}')) {
    EXACT.set(k, v);
    if (!LOWER.has(k.toLowerCase())) LOWER.set(k.toLowerCase(), v.toLowerCase());
    continue;
  }
  const lit = k.replace(/\{\}/g, '');
  if (!/[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(lit)) continue;
  const re = new RegExp(`^${k.split('{}').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*?)')}$`, 's');
  PATTERNS.push({ re, out: v, lit: lit.length });
}
PATTERNS.sort((a, b) => b.lit - a.lit);

/** Słownik EN → PL dla nowych napisów: dokładnie i wzorce (`lits` = kawałki klucza między `{}`). */
const PL_EXACT = new Map<string, string>();
const PL_PATTERNS: { re: RegExp; out: string; lits: string[] }[] = [];
for (const [k, v] of Object.entries(PL)) {
  if (!k.includes('{}')) { PL_EXACT.set(k, v); continue; }
  const lits = k.split('{}');
  PL_PATTERNS.push({ re: new RegExp(`^${lits.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*?)')}$`, 's'), out: v, lits });
}
PL_PATTERNS.sort((a, b) => b.lits.join('').length - a.lits.join('').length);

/**
 * Napis ze słownika EN → PL: po polsku albo (w trybie angielskim) bez zmian. Wstawki tłumaczone osobno, bo mogą
 * pochodzić z polskiego kodu (nazwy bohaterów, liczby). `undefined`, gdy napisu nie ma w słowniku.
 */
function english(s: string): string | undefined {
  const hit = PL_EXACT.get(s);
  if (hit !== undefined) return lang === 'pl' ? hit : s;
  for (const p of PL_PATTERNS) {
    const m = p.re.exec(s);
    if (!m) continue;
    // Wstawka-lista („A, B”): każdy element osobno, gdy całość nie ma tłumaczenia.
    const ins = m.slice(1).map((x) => { const t = tr(x); return t === x && x.includes(', ') ? x.split(', ').map(tr).join(', ') : t; });
    if (lang === 'pl') { let i = 0; return p.out.replace(/\{\}/g, () => ins[i++]); }
    return p.lits.map((l, i) => l + (ins[i] ?? '')).join('');
  }
  return undefined;
}

const LETTER = /[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
/** Separatory od najmocniejszego: kawałki tłumaczone osobno, zdania zostają w całości jak najdłużej. */
const SEPS = [/(\s{2,})/, /(: )/, /(?<=\.)( )/, /(; | \+ |^\+ | > | = | \/ |< | >$)/, /(, )/, /( - |\(|\)|\[|\])/];

function exact(s: string): string | undefined {
  return EXACT.get(s) ?? (s === s.toLowerCase() ? LOWER.get(s) : undefined);
}

const DIACRITIC = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;
/** Częste polskie słowa bez znaków diakrytycznych (ocena resztek po tłumaczeniu). */
const PL_WORDS = new Set(['na', 'do', 'za', 'nie', 'przy', 'oraz', 'albo', 'lub', 'szansy', 'krytyk', 'wroga', 'wrogowie', 'poziom', 'czasu', 'razem', 'co', 'od', 'po', 'przez', 'jest', 'ataku', 'ruchu', 'pancerza', 'maks']);

/** Ile polskiego zostało w napisie: znaki diakrytyczne i słowa ze słownika z innym tłumaczeniem. */
function polish(t: string): number {
  let n = t.match(DIACRITIC)?.length ?? 0;
  for (const w of t.split(/[\s,.:;!?()]+/)) if ((w.length > 2 && EXACT.has(w) && EXACT.get(w) !== w) || PL_WORDS.has(w)) n++;
  return n;
}

function translate(s: string, depth: number): string {
  if (!LETTER.test(s)) return s;
  const lead = s.match(/^\s*/)![0], trail = s.match(/\s*$/)![0];
  const core = s.slice(lead.length, s.length - trail.length);
  const hit = exact(core);
  if (hit !== undefined) return lead + hit + trail;
  if (depth > 8) return s;
  // Kandydaci; wygrywa ten z najmniejszą liczbą polskich resztek (przy remisie wcześniejszy).
  const cands: string[] = [];
  const pick = () => cands.reduce((a, b) => (polish(b) < polish(a) ? b : a));
  // Ujemny wariant linii z "+" (porównania przedmiotów: "-5% obrażeń").
  if (core.startsWith('-')) {
    const pos = translate(`+${core.slice(1)}`, depth + 1);
    if (pos.startsWith('+') && pos !== `+${core.slice(1)}`) cands.push('-' + pos.slice(1));
  }
  // Pierwszy pasujący wzorzec (potrafi połknąć w `{}` kilka fraz, stąd porównanie z podziałem).
  for (const p of PATTERNS) {
    const m = p.re.exec(core);
    if (!m) continue;
    let i = 1;
    cands.push(p.out.replace(/\{\}/g, () => translate(m[i++], depth + 1)));
    break;
  }
  if (!cands.length || polish(pick()) > 0) {
    // Nazwa z dopisaną kropką / wykrzyknikiem ("Kula piorunów.").
    const punct = core.match(/[.!?:]$/)?.[0];
    if (punct) {
      const bare = translate(core.slice(0, -1), depth + 1);
      if (bare !== core.slice(0, -1)) cands.push(bare + punct);
    }
    // Zdania osobno (opis + „Żywioł: …” + „Zostają: …”): kandydat obok podziału na separatorach niżej.
    // Tylko przed wielką literą: skróty („maks. 30”, „poz. maks.”) nie kończą zdania.
    const sents = core.split(/(?<=[.!?])( )(?=[A-ZĄĆĘŁŃÓŚŹŻ])/);
    if (sents.length > 1) {
      const t = sents.map((x, i) => (i % 2 ? x : translate(x, depth + 1))).join('');
      if (t !== core) cands.push(t);
    }
    // Podział na kawałki: pierwszy poziom separatorów, który coś zmienia — w całości i tylko na pierwszym
    // separatorze ("3: Trafienia: 4% szans..." = próg + opis z dwukropkiem).
    for (const sep of SEPS) {
      // split z grupą przechwytującą: separatory na nieparzystych indeksach.
      const parts = core.split(sep);
      if (parts.length < 2) continue;
      const done = parts.map((x, i) => (i % 2 ? x : translate(x, depth + 1)));
      const first = parts.length > 3 ? translate(parts[0], depth + 1) + parts[1] + translate(parts.slice(2).join(''), depth + 1) : core;
      if (first !== core) cands.push(first);
      if (!done.some((x, i) => x !== parts[i])) { if (first !== core) break; continue; }
      cands.push(done.join(''));
      break;
    }
  }
  if (cands.length) return lead + pick() + trail;
  const words = core.split(' ');
  // Liczba na końcu albo na początku ("Krwawy księżyc 1s", "+1 Kamień kowalski"): reszta tłumaczona w całości.
  const last = words[words.length - 1];
  if (words.length > 1 && /\d/.test(last)) {
    const rest = words.slice(0, -1).join(' '), t = translate(rest, depth + 1);
    if (t !== rest) return lead + t + ' ' + last + trail;
  }
  if (words.length > 1 && /\d/.test(words[0])) {
    const rest = words.slice(1).join(' '), t = translate(rest, depth + 1);
    if (t !== rest) return lead + words[0] + ' ' + t + trail;
  }
  if (words.length > 1 && words.length <= 5) {
    // Słowa z cyframi ("26m", "x2") i liczby rzymskie (progi synergii) zostają bez zmian.
    const done = words.map((w) => (LETTER.test(w) && !/\d|^[IVX]+$/.test(w) ? exact(w) : w));
    if (done.every((w) => w !== undefined)) return lead + done.join(' ') + trail;
  }
  return s;
}

/**
 * Polski: polskie napisy zostają, ale angielskie kawałki wstawione w polski szablon („Broń: Two Swords”, „Zasób: Rhythm”)
 * tłumaczą się osobno — podział na tych samych separatorach co w kierunku PL → EN.
 */
const PL_SEPS = [/(\s{2,})/, /(: )/, /(?<=[.!?])( )(?=[A-Z])/, /(; | \/ )/, /(, )/, /( \(|\))/];
function toPolish(s: string, depth: number): string {
  if (depth > 6 || !LETTER.test(s)) return s;
  // Angielska nazwa z końcową interpunkcją (banery „Falcon Shot!”): tłumaczy się sama nazwa.
  const m = /^(.*?)([.!?:]+)$/.exec(s);
  if (m) {
    const h = english(m[1]);
    if (h !== undefined) return h + m[2];
  }
  for (const sep of PL_SEPS) {
    const parts = s.split(sep);
    if (parts.length < 2) continue;
    const done = parts.map((x, i) => (i % 2 ? x : english(x.trim()) !== undefined ? x.replace(x.trim(), english(x.trim())!) : toPolish(x, depth + 1)));
    if (done.some((x, i) => x !== parts[i])) return done.join('');
  }
  return s;
}

/** Diagnostyka (bot testowy, tylko wersja deweloperska): napisy bez tłumaczenia w bieżącym języku. */
export const trMisses = new Set<string>();
const EN_WORDS = /\b(the|and|your|with|you|of|for|is|are|when|each|every)\b/i;
/** Polskie słowa bez znaków diakrytycznych, których nie ma w angielskim (resztki po tłumaczeniu). */
const PL_LEFT = /\b(tylko|oraz|albo|przez|jest|nie|dla|lub|poziom|razem|wroga|wrogowie|ataku|pancerza|szansy|maks)\b/i;
function checkMiss(s: string, t: string): void {
  if (trMisses.size > 500) return;
  const miss = lang === 'en' ? /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(t) || PL_LEFT.test(t) : t === s && !/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(t) && EN_WORDS.test(t);
  if (miss) trMisses.add(`${lang}: ${s}`);
}

/** Napis w bieżącym języku: nowe angielskie przez słownik EN → PL, stare polskie przez słownik PL → EN. */
export function tr(s: string): string {
  if (!s) return s;
  let t = cache.get(s);
  if (t === undefined) {
    if (cache.size > CACHE_MAX) cache.clear();
    t = english(s) ?? (lang === 'pl' ? toPolish(s, 0) : translate(s, 0));
    if (import.meta.env.DEV) checkMiss(s, t);
    cache.set(s, t);
  }
  return t;
}
