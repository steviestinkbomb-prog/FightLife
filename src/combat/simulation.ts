import { positions } from '../data/positions';
import { availableTechniques, techniques } from '../data/techniques';
import { endMatch, queueScore, updateRules } from '../rules/bjj';
import { emit } from './events';
import type { Fighter, FighterId, Input, MatchConfig, MatchState, PositionId, Profile } from './types';
export const STEP = 1 / 60;
export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
const other = (id: FighterId): FighterId => id === 0 ? 1 : 0;
export function createMatch(player: Profile, opponent: Profile, config: Partial<MatchConfig> = {}): MatchState {
  const full: MatchConfig = { duration: 180, difficulty: 'beginner', seed: 42, training: false, cpu: true, ...config };
  const make = (profile: Profile, x: number, angle: number): Fighter => ({ profile, x, y: 350, vx: 0, vy: 0, angle, stamina: 100, balance: 1, control: 0.5, momentum: 0, defenseUntil: -1, defenseStart: -2, defenseCooldown: -1, evadeUntil: -1, recoveryUntil: 0, distanceTravelled: 0, attempts: 0, successes: 0, defenses: 0, submissions: 0 });
  const s: MatchState = { fighters: [make(player, 390, 0), make(opponent, 610, Math.PI)], position: full.startPosition ?? 'standing', top: full.startTop ?? 0, time: 0, remaining: full.duration, epoch: 0, positionTime: 0, positionAngle: 0, score: [0, 0], actions: [null, null], buffers: [null, null], submission: null, pendingScores: [], events: [], result: null, config: full, scramble: null, rng: full.seed >>> 0 || 1, ai: { nextDecision: 0.6, seenAction: '', seenAt: 0, habits: {}, targetX: 0, targetY: 0 }, lastMessage: 'Touch gloves. Make your first move.' };
  if (positions[s.position].grounded || s.position === 'clinch') {
    const d = positions[s.position].separation / 2; s.fighters[0].x = 500 - d; s.fighters[1].x = 500 + d;
  }
  emit(s, 'started', full.training ? 'Practice begins. No clock, no points.' : 'Match started · adult no-gi points');
  return s;
}
export function random(s: MatchState): number {
  // Seeded choice variation for AI; technique outcomes themselves contain no chance roll.
  s.rng ^= s.rng << 13; s.rng ^= s.rng >>> 17; s.rng ^= s.rng << 5;
  return (s.rng >>> 0) / 4294967296;
}
export function transition(s: MatchState, to: PositionId, top: FighterId, actor: FighterId): boolean {
  if (s.result || !positions[s.position].connections.includes(to)) return false;
  s.position = to; s.top = top; s.epoch++; s.positionTime = 0;
  const a = s.fighters[top], b = s.fighters[other(top)];
  s.positionAngle = Math.atan2(b.y - a.y, b.x - a.x);
  const interrupted = s.actions[other(actor)];
  if (interrupted) { emit(s, 'failed', `${s.fighters[other(actor)].profile.name}'s ${techniques[interrupted.id].short.toLowerCase()} was interrupted by the transition.`, other(actor), 'interrupted'); s.fighters[other(actor)].recoveryUntil = s.time + 0.3; }
  s.actions = [null, null];
  s.fighters[top].control = positions[to].control;
  s.fighters[other(top)].control = 1 - positions[to].control;
  emit(s, 'position', `${positions[to].name} · ${s.fighters[top].profile.name} ${positions[to].grounded ? 'on top' : 'engages'}`, actor, to);
  return true;
}
export function startAction(s: MatchState, actor: FighterId, id: string): boolean {
  if (s.result || s.submission || s.time < s.fighters[actor].recoveryUntil) return false;
  if (s.actions[actor]) { s.buffers[actor] = id; return false; }
  const t = availableTechniques(s, actor).find(t => t.id === id);
  if (!t) return false;
  const f = s.fighters[actor];
  f.stamina -= t.cost; f.attempts++;
  s.actions[actor] = { id, actor, elapsed: 0, duration: t.duration, epoch: s.epoch, started: s.time, origin: s.position, defended: false };
  if (actor === 0) s.ai.habits[id] = (s.ai.habits[id] ?? 0) + 1;
  emit(s, 'technique', `${f.profile.name}: ${t.name}`, actor, 'started');
  return true;
}
export function defenseQuality(s: MatchState, actor: FighterId, started: number): number {
  const f = s.fighters[actor];
  if (f.defenseUntil < s.time) return 0;
  const reaction = f.defenseStart - started;
  // A defense prepared before an attack is weaker than a reaction to its visible startup.
  return reaction >= 0.08 && reaction <= 0.72 ? 1 : 0.28;
}
function pressure(f: Fighter, o: Fighter, input: Input): number {
  const d = Math.max(1, Math.hypot(o.x - f.x, o.y - f.y));
  return clamp((input.x * (o.x - f.x) + input.y * (o.y - f.y)) / d, -1, 1);
}
function resolveAction(s: MatchState, actor: FighterId, inputs: [Input, Input]): void {
  const a = s.actions[actor]; if (!a) return;
  const t = techniques[a.id], target = other(actor), f = s.fighters[actor], o = s.fighters[target];
  if (a.epoch !== s.epoch) { s.actions[actor] = null; return; }
  const distance = Math.hypot(o.x - f.x, o.y - f.y);
  const q = a.defended ? 1 : defenseQuality(s, target, a.started);
  const facing = Math.cos(f.angle - Math.atan2(o.y - f.y, o.x - f.x));
  const effort = f.profile.skills[t.skill] * 0.003 + f.stamina * 0.002 + f.balance * 0.18 + f.control * 0.14 + f.momentum * 0.09 + pressure(f, o, inputs[actor]) * (t.kind === 'escape' ? -0.14 : 0.14) + (t.range ? facing * 0.17 : 0.12);
  const resistance = 0.17 + o.profile.skills[t.defense] * 0.0022 + o.stamina * 0.001 + o.control * 0.11 + q * 0.66;
  const safeMove = ['openGuard', 'halfGuard', 'turtle', 'release'].includes(t.id);
  const succeeds = (!t.range || distance < t.range + 16) && (safeMove && q < 0.5 || effort > resistance) && (!t.range || facing > 0.15);
  s.actions[actor] = null; f.recoveryUntil = s.time + (succeeds ? 0.25 : 0.55);
  if (!succeeds) {
    f.balance = Math.max(0.3, f.balance - 0.22); f.momentum *= 0.4;
    if (q > 0.5) { o.defenses++; o.control = clamp(o.control + 0.12, 0, 1); emit(s, 'defended', `${o.profile.name} counters the ${t.short.toLowerCase()}.`, target, 'counter'); }
    else emit(s, 'failed', `${t.short} denied · improve angle, energy, or pressure.`, actor, 'failed');
    return;
  }
  f.successes++; f.momentum = clamp(f.momentum + 0.22, 0, 1);
  if (t.kind === 'submission') {
    const name = s.position === 'backControl' ? 'Rear control submission' : s.position === 'closedGuard' ? 'Guard submission' : 'Arm-control submission';
    s.submission = { actor, progress: 0.16, elapsed: 0, name, origin: s.position }; f.submissions++;
    emit(s, 'submission', `${name} · attacker hold J, defender hold Q and move away`, actor, 'contested');
    return;
  }
  if (!t.to) return;
  const top = t.flip ? other(actor) : positions[s.position].grounded ? s.top : actor;
  // Sweeps invert the old top; a guard pull gives the opponent the top relationship.
  const nextTop = t.kind === 'sweep' ? actor : top;
  if (!transition(s, t.to, nextTop, actor)) return;
  if (t.kind === 'takedown') s.scramble = { actor, remaining: 0.85, defended: false };
  if (t.kind === 'sweep') { queueScore(s, actor, 'sweep'); }
  if (t.score) queueScore(s, actor, t.score);
  if (t.to === 'neutralRestart') centerRestart(s);
}
function centerRestart(s: MatchState): void {
  // Reposition with a visible interpolation rather than assigning fighter coordinates.
  s.positionAngle = 0;
  emit(s, 'restart', 'Referee: return to neutral in the center.');
}
function updateSubmission(s: MatchState, dt: number, inputs: [Input, Input]): void {
  const sub = s.submission; if (!sub) return;
  const target = other(sub.actor), a = s.fighters[sub.actor], b = s.fighters[target];
  sub.elapsed += dt;
  const attackInput = inputs[sub.actor], defendInput = inputs[target];
  const commitment = attackInput.hold ? 1 : 0;
  const defensive = defendInput.defend ? 1 : 0;
  const ap = pressure(a, b, attackInput), dp = -pressure(b, a, defendInput);
  a.stamina = clamp(a.stamina - dt * (commitment ? 5.5 : 2), 0, 100);
  b.stamina = clamp(b.stamina - dt * (defensive ? 3.4 : 1.5), 0, 100);
  const offense = (0.035 + commitment * 0.15 + ap * 0.038 + a.profile.skills.submission * 0.00065 + a.control * 0.025) * (0.3 + a.stamina / 125);
  const defense = (0.035 + defensive * 0.24 + Math.max(0, dp) * 0.065 + b.profile.skills.defense * 0.00035) * (0.45 + b.stamina / 150);
  sub.progress = clamp(sub.progress + (offense - defense) * dt, 0, 1);
  if (sub.progress >= 1) { endMatch(s, sub.actor, 'Submission'); return; }
  if (sub.progress <= 0 || a.stamina < 4 || sub.elapsed > 18) {
    s.submission = null; a.recoveryUntil = s.time + 0.75; b.defenses++;
    emit(s, 'defended', `${b.profile.name} escapes the submission.`, target, 'escaped');
    if (s.position === 'backControl') transition(s, 'halfGuard', s.top, target);
  }
}
function updateMovement(s: MatchState, dt: number, inputs: [Input, Input]): void {
  const connected = s.position !== 'standing' && s.position !== 'neutralRestart';
  const grounded = positions[s.position].grounded;
  for (const id of [0, 1] as FighterId[]) {
    const f = s.fighters[id], o = s.fighters[other(id)], input = inputs[id];
    const length = Math.hypot(input.x, input.y), normalized = Math.max(1, length);
    const moving = length > 0.01;
    const busy = !!s.actions[id] || !!s.submission;
    const burst = input.sprint && f.stamina > 12 && !grounded;
    const speed = (grounded ? 27 : s.position === 'clinch' ? 42 : 120) * (burst ? 1.55 : 1) * (busy ? 0.35 : 1) * (0.58 + f.stamina / 240);
    const targetX = input.x / normalized * speed, targetY = input.y / normalized * speed;
    f.vx += (targetX - f.vx) * Math.min(1, dt * 12); f.vy += (targetY - f.vy) * Math.min(1, dt * 12);
    const dx = f.vx * dt, dy = f.vy * dt; if (!connected) { f.x += dx; f.y += dy; } f.distanceTravelled += Math.hypot(dx, dy);
    if (!grounded) {
      const desired = input.face ?? (moving ? Math.atan2(input.y, input.x) : Math.atan2(o.y - f.y, o.x - f.x));
      const delta = Math.atan2(Math.sin(desired - f.angle), Math.cos(desired - f.angle)); f.angle += delta * Math.min(1, dt * 15);
    }
    const draining = burst && moving || f.evadeUntil > s.time;
    // Stamina recovers through measured pauses; committed actions interrupt that recovery.
    const regeneration = !busy && !input.defend ? (moving ? 2 : 5.2) + f.profile.skills.cardio * 0.013 : 0;
    f.stamina = clamp(f.stamina + dt * (regeneration - (draining ? 11 : 0) - (input.defend ? 2.3 : 0)), 0, 100);
    f.balance = clamp(f.balance + dt * (burst && moving ? -0.15 : 0.25), 0.25, 1);
    f.momentum = Math.max(0, f.momentum - dt * 0.035);
    if (connected) f.control = clamp(f.control + dt * pressure(f, o, input) * 0.045, 0, 1);
    f.x = clamp(f.x, 118, 882); f.y = clamp(f.y, 125, 575);
  }
  if (connected) {
    const vx = (s.fighters[0].vx + s.fighters[1].vx) / 2, vy = (s.fighters[0].vy + s.fighters[1].vy) / 2;
    for (const f of s.fighters) { f.x += vx * dt; f.y += vy * dt; }
  }
  const a = s.fighters[s.top], b = s.fighters[other(s.top)];
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d < 0.001) { dx = 1; dy = 0; d = 1; }
  if (connected) {
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    if (!grounded) s.positionAngle = Math.atan2(dy, dx);
    const sep = positions[s.position].separation;
    const factor = Math.min(1, dt * 10);
    const nx = Math.cos(s.positionAngle), ny = Math.sin(s.positionAngle);
    a.x += (cx - nx * sep / 2 - a.x) * factor; a.y += (cy - ny * sep / 2 - a.y) * factor;
    b.x += (cx + nx * sep / 2 - b.x) * factor; b.y += (cy + ny * sep / 2 - b.y) * factor;
    if (grounded) { a.angle = s.positionAngle; b.angle = s.positionAngle + (s.position === 'backControl' ? 0 : Math.PI); }
    if ((cx < 160 || cx > 840 || cy < 160 || cy > 540) && s.positionTime > 1) {
      // Boundary contact preserves grounded positions, roles, submissions, and scoring state.
      const shiftX = (500 - cx) * dt * 3, shiftY = (350 - cy) * dt * 3;
      for (const f of s.fighters) { f.x += shiftX; f.y += shiftY; }
      s.lastMessage = 'Referee: action returns to center; position is preserved.';
    }
  } else if (d < 65) {
    const correction = (65 - d) / 2;
    a.x -= dx / d * correction; a.y -= dy / d * correction; b.x += dx / d * correction; b.y += dy / d * correction;
  }
  if (s.position === 'neutralRestart') {
    for (const id of [0, 1] as FighterId[]) { const f = s.fighters[id]; f.x += ((id === 0 ? 420 : 580) - f.x) * dt * 5; f.y += (350 - f.y) * dt * 5; }
    if (s.positionTime > 0.7) transition(s, 'standing', s.top, 0);
  }
}
export function tick(s: MatchState, inputs: [Input, Input], dt = STEP): void {
  if (s.result) return;
  s.time += dt; s.positionTime += dt;
  for (const id of [0, 1] as FighterId[]) {
    const f = s.fighters[id], input = inputs[id];
    if (input.tap) { endMatch(s, other(id), 'Tap'); return; }
    if (input.defend && s.time >= f.defenseCooldown && f.stamina >= 5) {
      f.defenseStart = s.time; f.defenseUntil = s.time + 0.67; f.defenseCooldown = s.time + 1.3; f.stamina -= 3;
      const attack = s.actions[other(id)];
      if (attack && s.time - attack.started >= 0.08 && attack.elapsed < attack.duration * 0.92) attack.defended = true;
      if (s.scramble && s.scramble.actor !== id) s.scramble.defended = true;
    }
    if (input.evade && s.time > f.evadeUntil + 0.8 && !positions[s.position].grounded && f.stamina >= 7) { f.evadeUntil = s.time + 0.25; f.stamina -= 7; const opponent = s.fighters[other(id)]; const distance = Math.max(1, Math.hypot(f.x - opponent.x, f.y - opponent.y)); f.vx += (f.x - opponent.x) / distance * 180; f.vy += (f.y - opponent.y) / distance * 180; f.balance = Math.min(1, f.balance + 0.1); f.defenseUntil = s.time + 0.25; }
    if (input.action && !s.submission) startAction(s, id, input.action);
  }
  updateMovement(s, dt, inputs);
  if (s.submission) updateSubmission(s, dt, inputs);
  else for (const id of [0, 1] as FighterId[]) {
    const a = s.actions[id]; if (a) { a.elapsed += dt; if (a.elapsed >= a.duration) resolveAction(s, id, inputs); }
    if (!s.actions[id] && s.buffers[id] && s.time >= s.fighters[id].recoveryUntil) { const buffered = s.buffers[id]!; s.buffers[id] = null; startAction(s, id, buffered); }
  }
  if (s.scramble) {
    s.scramble.remaining -= dt;
    if (s.scramble.remaining <= 0) {
      const scramble = s.scramble; s.scramble = null;
      if (scramble.defended) { transition(s, 'clinch', s.top, other(scramble.actor)); emit(s, 'defended', 'Late sprawl! Both fighters recover to the clinch.', other(scramble.actor), 'scramble escaped'); }
      else { transition(s, 'closedGuard', scramble.actor, scramble.actor); queueScore(s, scramble.actor, 'takedown'); }
    }
  }
  updateRules(s, dt);
}
