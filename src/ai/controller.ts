import { availableTechniques } from '../data/techniques';
import { positions } from '../data/positions';
import { random } from '../combat/simulation';
import { idleInput, type Input, type MatchState } from '../combat/types';
export function cpuInput(s: MatchState): Input {
  const input = idleInput(); if (!s.config.cpu || s.result) return input;
  const me = s.fighters[1], opponent = s.fighters[0], ai = s.ai;
  const dx = opponent.x - me.x, dy = opponent.y - me.y, distance = Math.max(1, Math.hypot(dx, dy));
  input.face = Math.atan2(dy, dx);
  const style = me.profile.style;
  const passive = style === 'passive';
  const grounded = positions[s.position].grounded;
  if (passive) return input;
  const reaction = { beginner: 0.7, intermediate: 0.38, advanced: 0.19 }[s.config.difficulty];
  const attack = s.actions[0];
  if (attack) {
    const key = `${attack.id}:${attack.started}`;
    if (ai.seenAction !== key) { ai.seenAction = key; ai.seenAt = s.time; }
    const repeats = ai.habits[attack.id] ?? 0;
    // Reads only a committed, visible action. Never reads the player's future inputs.
    const aware = s.config.difficulty !== 'beginner' || repeats > 3 || style === 'defensive';
    if (!passive && aware && s.time - ai.seenAt >= reaction && s.time >= me.defenseCooldown) input.defend = true;
  }
  if (s.submission) {
    if (s.submission.actor === 1) { input.hold = true; input.x = dx / distance; input.y = dy / distance; }
    else {
      const phase = s.submission.elapsed % 4;
      input.defend = !passive && s.submission.elapsed > reaction && (s.config.difficulty !== 'beginner' || phase > 1.3 && phase < 2.9);
      input.x = -dx / distance; input.y = -dy / distance;
    }
    return input;
  }
  if (grounded || s.position === 'clinch' || s.scramble) {
    // Top applies pressure; bottom actively creates space rather than staying idle.
    const direction = s.top === 1 || !grounded ? 1 : -0.7;
    if (!passive) { input.x = dx / distance * direction; input.y = dy / distance * direction; }
    if (s.scramble && s.scramble.actor === 0 && s.config.difficulty !== 'beginner' && s.positionTime > reaction) input.defend = true;
  } else if (!passive) {
    const desired = style === 'defensive' ? 83 : 72;
    if (distance > desired || s.time > ai.nextDecision - 0.15) { input.x = dx / distance; input.y = dy / distance; }
    else if (distance < 65) { input.x = -dx / distance; input.y = -dy / distance; }
    else { input.x = -dy / distance * 0.3; input.y = dx / distance * 0.3; }
  }
  if (passive || s.time < ai.nextDecision || s.actions[1] || me.recoveryUntil > s.time) return input;
  ai.nextDecision = s.time + reaction + 0.3 + random(s) * 0.3;
  if (me.stamina < 24) { input.x = -dx / distance; input.y = -dy / distance; return input; }
  const options = availableTechniques(s, 1);
  let best: string | undefined, bestValue = -Infinity;
  for (const technique of options) {
    let value = random(s) * 0.35;
    if (technique.kind === 'takedown') value += style === 'wrestler' || style === 'defensive' ? 1.8 : 1.1;
    if (technique.kind === 'engage') value += 0.9;
    if (technique.kind === 'escape') value += s.top === 0 ? 1.2 : 0.1;
    if (technique.id === 'pass' || technique.id === 'mount' || technique.id === 'secure') value += style === 'pressure' ? 2 : 1.5;
    if (technique.id === 'takeBack') value += 1.6;
    if (technique.id === 'sweep') value += style === 'guard' ? 2 : 1.3;
    if (technique.id === 'submit') value += s.position === 'mount' || s.position === 'backControl' ? 2.6 : style === 'guard' ? 1.8 : 0.9;
    if (technique.id === 'pullGuard') value += style === 'guard' ? 1.9 : -0.5;
    if (technique.id === 'release') value -= 0.5;
    if (technique.id === 'stand') value += s.score[1] > s.score[0] && s.remaining < 30 ? 1.5 : 0;
    if (technique.id === 'bridge') value += style === 'wrestler' ? 1.5 : 0.3;
    if (me.stamina < 45) value -= technique.cost / 15;
    if (value > bestValue) { bestValue = value; best = technique.id; }
  }
  input.action = best;
  return input;
}
