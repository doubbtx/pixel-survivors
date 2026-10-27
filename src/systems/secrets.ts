import { sfx } from '../core/audio';
import { C } from '../core/palette';
import { SECRETS, PACIFIST_KEY, type SecretDef } from '../data/secrets';
import type { Run } from '../game/run';

/** Co ile kroków sprawdzane są warunki sekretów (0,5 s). */
const CHECK_EVERY = 30;

/**
 * Księga sekretów w runie: budzenie sekretów (baner, zatrzymanie klatki, kolekcja), wyłączanie sekretów `while`,
 * gdy warunek przestaje być spełniony. Efekty liczy Run.indexEffects / recomputeStats (`activeSecrets`).
 */
export function updateSecrets(run: Run): void {
  if (run.step % CHECK_EVERY) return;
  let changed = false;
  for (const s of SECRETS) {
    if (s.hero && s.hero !== run.hero.id) continue;
    const on = run.secrets.has(s.id);
    if (on && !s.while) continue;
    const ok = s.check(run);
    if (ok && !on) { awaken(run, s); changed = true; }
    else if (!ok && on) { run.secrets.delete(s.id); changed = true; }
  }
  if (changed) run.onBuildChanged();
}

function awaken(run: Run, s: SecretDef): void {
  run.secrets.add(s.id);
  // Sekret `while` ogłaszany tylko przy pierwszym obudzeniu w runie.
  if (run.cardState[`seen.${s.id}`]) return;
  run.cardState[`seen.${s.id}`] = 1;
  run.secretsFound.add(s.id);
  if (s.id === 'pacifist') run.cardState[PACIFIST_KEY] = 1;
  run.showBanner(`Sekret: ${s.name}!`);
  run.burst(run.player.x, run.player.y, C.hotpink, 30, 90);
  run.freeze(0.35);
  sfx.play('levelup');
}

/** Definicje aktywnych sekretów (dla efektów w Run). */
export function activeSecrets(run: Run): SecretDef[] {
  return SECRETS.filter((s) => run.secrets.has(s.id));
}
