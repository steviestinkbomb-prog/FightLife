import type { FighterId, MatchState, PositionId, Skills } from '../combat/types';
import { guards, positions } from './positions';
export type TechniqueKind = 'engage' | 'takedown' | 'transition' | 'sweep' | 'escape' | 'submission' | 'release';
export interface Technique { id: string; name: string; short: string; from: PositionId[]; role: 'either' | 'top' | 'bottom'; to?: PositionId; kind: TechniqueKind; skill: keyof Skills; defense: keyof Skills; cost: number; duration: number; range?: number; description: string; score?: 'pass' | 'mount' | 'back'; flip?: boolean }
export const techniques: Record<string, Technique> = Object.fromEntries(([
  { id: 'engage', name: 'Establish clinch', short: 'Clinch', from: ['standing'], role: 'either', to: 'clinch', kind: 'engage', skill: 'control', defense: 'defense', cost: 5, duration: 0.42, range: 94, description: 'Reach for upper-body control.' },
  { id: 'doubleLeg', name: 'Double-leg takedown', short: 'Double leg', from: ['standing', 'clinch'], role: 'either', to: 'takedownScramble', kind: 'takedown', skill: 'takedown', defense: 'defense', cost: 16, duration: 0.95, range: 108, description: 'Commit to a forward entry. Vulnerable to a timed sprawl.' },
  { id: 'singleLeg', name: 'Single-leg takedown', short: 'Single leg', from: ['standing', 'clinch'], role: 'either', to: 'takedownScramble', kind: 'takedown', skill: 'takedown', defense: 'defense', cost: 13, duration: 1.18, range: 94, description: 'A slower entry with a smaller energy cost.' },
  { id: 'pullGuard', name: 'Pull closed guard', short: 'Pull guard', from: ['standing', 'clinch'], role: 'either', to: 'closedGuard', kind: 'transition', skill: 'guard', defense: 'control', cost: 9, duration: 0.75, range: 82, description: 'Sit to guard with a grip. No takedown points are awarded.', flip: true },
  { id: 'openGuard', name: 'Open the guard', short: 'Open guard', from: ['closedGuard', 'halfGuard'], role: 'either', to: 'openGuard', kind: 'transition', skill: 'guard', defense: 'control', cost: 7, duration: 0.7, description: 'Create space and loosen the control relationship.' },
  { id: 'halfGuard', name: 'Half-guard entry', short: 'Half guard', from: ['openGuard', 'closedGuard'], role: 'either', to: 'halfGuard', kind: 'transition', skill: 'passing', defense: 'guard', cost: 8, duration: 0.82, description: 'Contest one leg and change the angle.' },
  { id: 'closeGuard', name: 'Recover closed guard', short: 'Close guard', from: ['openGuard', 'halfGuard', 'groundScramble'], role: 'bottom', to: 'closedGuard', kind: 'escape', skill: 'guard', defense: 'control', cost: 9, duration: 0.8, description: 'Reconnect your guard and prevent the pass.' },
  { id: 'pass', name: 'Pressure guard pass', short: 'Pass guard', from: guards, role: 'top', to: 'sideControl', kind: 'transition', skill: 'passing', defense: 'guard', cost: 16, duration: 1.35, description: 'Clear the legs and hold side control for three seconds.', score: 'pass' },
  { id: 'sweep', name: 'Guard sweep', short: 'Sweep', from: guards, role: 'bottom', to: 'groundScramble', kind: 'sweep', skill: 'guard', defense: 'defense', cost: 15, duration: 1.1, description: 'Off-balance your opponent and contest the top position.', flip: true },
  { id: 'mount', name: 'Advance to mount', short: 'Mount', from: ['sideControl', 'backControl'], role: 'top', to: 'mount', kind: 'transition', skill: 'control', defense: 'guard', cost: 12, duration: 1.1, description: 'Cross the torso and establish stable mount.', score: 'mount' },
  { id: 'takeBack', name: 'Secure back control', short: 'Take back', from: ['sideControl', 'mount', 'turtle'], role: 'top', to: 'backControl', kind: 'transition', skill: 'control', defense: 'defense', cost: 14, duration: 1.3, description: 'Secure both hooks and contest rear control.', score: 'back' },
  { id: 'escape', name: 'Frame and recover guard', short: 'Recover guard', from: ['sideControl', 'mount', 'backControl'], role: 'bottom', to: 'halfGuard', kind: 'escape', skill: 'guard', defense: 'control', cost: 12, duration: 1.0, description: 'Build frames and escape toward half guard.' },
  { id: 'bridge', name: 'Bridge into scramble', short: 'Bridge', from: ['mount', 'sideControl', 'backControl', 'halfGuard'], role: 'bottom', to: 'groundScramble', kind: 'escape', skill: 'defense', defense: 'control', cost: 18, duration: 0.85, description: 'Explosive movement loosens control; follow with a recovery.' },
  { id: 'turtle', name: 'Turn to turtle', short: 'Turtle', from: ['sideControl', 'groundScramble'], role: 'bottom', to: 'turtle', kind: 'escape', skill: 'defense', defense: 'control', cost: 8, duration: 0.65, description: 'Protect position but expose a back-control opportunity.' },
  { id: 'roll', name: 'Roll to open guard', short: 'Recover guard', from: ['turtle'], role: 'bottom', to: 'openGuard', kind: 'escape', skill: 'guard', defense: 'control', cost: 11, duration: 0.95, description: 'Rotate into a connected defensive guard.' },
  { id: 'secure', name: 'Secure side control', short: 'Secure top', from: ['groundScramble', 'turtle'], role: 'top', to: 'sideControl', kind: 'transition', skill: 'control', defense: 'guard', cost: 11, duration: 0.95, description: 'Settle the scramble into top control.' },
  { id: 'stand', name: 'Technical stand-up', short: 'Stand up', from: ['openGuard', 'turtle', 'groundScramble'], role: 'bottom', to: 'neutralRestart', kind: 'escape', skill: 'defense', defense: 'control', cost: 16, duration: 1.2, description: 'Break contact and recover standing; no BJJ escape points.' },
  { id: 'submit', name: 'Submission attack', short: 'Submission', from: ['closedGuard', 'sideControl', 'mount', 'backControl'], role: 'either', kind: 'submission', skill: 'submission', defense: 'defense', cost: 13, duration: 0.85, description: 'Secure an abstract control contest. Hold J and drive toward your opponent.' },
  { id: 'release', name: 'Break the clinch', short: 'Disengage', from: ['clinch'], role: 'either', to: 'standing', kind: 'release', skill: 'defense', defense: 'control', cost: 6, duration: 0.45, description: 'Break upper-body grips and return to open movement.' },
] satisfies Technique[]).map(t => [t.id, t]));
// A technique is offered only when its starting state, role, geometry, and resources permit it.
export function availableTechniques(s: MatchState, actor: FighterId): Technique[] {
  if (s.result || s.submission || s.scramble || s.position === 'neutralRestart') return [];
  const f = s.fighters[actor], o = s.fighters[1 - actor];
  const grounded = positions[s.position].grounded;
  return Object.values(techniques).filter(t => {
    if (!t.from.includes(s.position) || f.stamina < t.cost) return false;
    if (grounded && t.role !== 'either' && (t.role === 'top') !== (s.top === actor)) return false;
    if (t.id === 'submit' && ((s.position === 'closedGuard') === (s.top === actor))) return false;
    if (t.range && Math.hypot(f.x - o.x, f.y - o.y) > t.range) return false;
    return true;
  });
}
export function contextualTechniques(s: MatchState, actor: FighterId): Technique[] {
  const all = availableTechniques(s, actor);
  const priority = s.position === 'standing' ? ['doubleLeg', 'engage', 'pullGuard', 'singleLeg'] : s.position === 'clinch' ? ['doubleLeg', 'singleLeg', 'pullGuard', 'release'] : s.top === actor ? ['pass', 'mount', 'takeBack', 'submit', 'secure', 'halfGuard', 'openGuard'] : ['sweep', 'escape', 'roll', 'closeGuard', 'submit', 'bridge', 'stand', 'openGuard', 'turtle', 'halfGuard'];
  return all.sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
}
