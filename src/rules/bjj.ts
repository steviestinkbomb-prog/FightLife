import type { FighterId, MatchState, PendingScore, Result } from '../combat/types';
import { positions } from '../data/positions';
import { emit } from '../combat/events';
// A deliberately limited adult no-gi points ruleset, not an official tournament certification.
export const bjjRules = { id: 'nogi-prototype', name: 'No-gi · points', stabilization: 3, points: { takedown: 2, sweep: 2, pass: 3, mount: 4, back: 4 } } as const;
export function queueScore(s: MatchState, actor: FighterId, kind: PendingScore['kind']): void {
  if (s.config.training) return;
  if (s.pendingScores.some(p => p.actor === actor && p.kind === kind)) return;
  s.pendingScores.push({ actor, kind, elapsed: 0, position: s.position });
}
export function endMatch(s: MatchState, winner: FighterId | null, method: Result['method']): void {
  if (s.result) return;
  s.result = { winner, method, time: s.time, score: [...s.score] };
  s.actions = [null, null]; s.buffers = [null, null]; s.submission = null; s.pendingScores = [];
  emit(s, 'ended', winner === null ? 'Regulation ends in a draw.' : `${s.fighters[winner].profile.name} wins by ${method.toLowerCase()}.`, winner, method);
}
export function updateRules(s: MatchState, dt: number): void {
  if (s.result || s.config.training) return;
  s.remaining = Math.max(0, s.config.duration - s.time);
  s.pendingScores = s.pendingScores.filter(p => {
    if (s.top !== p.actor || !positions[s.position].grounded) return false;
    const mustHold = p.kind === 'mount' || p.kind === 'back' || p.kind === 'pass';
    if (mustHold && s.position !== p.position) return false;
    if (s.position === 'groundScramble' || s.position === 'takedownScramble') { p.elapsed = 0; return true; }
    p.elapsed += dt;
    if (p.elapsed + 1e-8 < bjjRules.stabilization) return true;
    const points = bjjRules.points[p.kind];
    s.score[p.actor] += points;
    emit(s, 'score', `${s.fighters[p.actor].profile.name}: +${points} ${p.kind} · 3s control confirmed`, p.actor, String(points));
    return false;
  });
  if (s.remaining <= 0) endMatch(s, s.score[0] === s.score[1] ? null : s.score[0] > s.score[1] ? 0 : 1, s.score[0] === s.score[1] ? 'Draw' : 'Points');
}
