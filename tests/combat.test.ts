import { describe, expect, it } from 'vitest';
import { createMatch, STEP, startAction, tick, transition } from '../src/combat/simulation';
import { idleInput, type Input, type MatchState, type PositionId, type Style } from '../src/combat/types';
import { fighters } from '../src/data/fighters';
import { positions } from '../src/data/positions';
import { availableTechniques } from '../src/data/techniques';
import { cpuInput } from '../src/ai/controller';
import { queueScore } from '../src/rules/bjj';
const passive = { ...fighters[1], style: 'passive' as const };
const match = (position: PositionId = 'standing', top: 0 | 1 = 0): MatchState => createMatch(fighters[0], passive, { cpu: false, startPosition: position, startTop: top });
function advance(s: MatchState, seconds: number, a: Partial<Input> = {}, b: Partial<Input> = {}): void { for (let i = 0; i < Math.round(seconds / STEP); i++) tick(s, [{ ...idleInput(), ...a }, { ...idleInput(), ...b }]); }
function action(s: MatchState, actor: 0 | 1, id: string): void { expect(startAction(s, actor, id)).toBe(true); advance(s, 1.7); }
describe('movement and shared constraints', () => {
  it('moves continuously and maintains momentum before settling', () => {
    const s = match(), x = s.fighters[0].x; advance(s, 0.3, { x: 1 }); expect(s.fighters[0].x).toBeGreaterThan(x + 15);
    const vx = s.fighters[0].vx; advance(s, STEP); expect(s.fighters[0].vx).toBeGreaterThan(0); expect(s.fighters[0].vx).toBeLessThan(vx); advance(s, 1); expect(Math.abs(s.fighters[0].vx)).toBeLessThan(0.1);
  });
  it('does not let standing bodies pass through each other', () => {
    const s = match(); advance(s, 4, { x: 1 }, { x: -1 }); expect(s.fighters[0].x).toBeLessThan(s.fighters[1].x); expect(s.fighters[1].x - s.fighters[0].x).toBeCloseTo(65);
  });
  it('limits movement to the arena', () => { const s = match(); advance(s, 20, { x: -1, y: -1 }); expect(s.fighters[0].x).toBeGreaterThanOrEqual(118); expect(s.fighters[0].y).toBeGreaterThanOrEqual(125); });
  it('burst movement is faster and costs energy', () => {
    const slow = match(), fast = match(); advance(slow, 0.8, { y: -1 }); advance(fast, 0.8, { y: -1, sprint: true }); expect(fast.fighters[0].y).toBeLessThan(slow.fighters[0].y); expect(fast.fighters[0].stamina).toBeLessThan(100); expect(fast.fighters[0].balance).toBeLessThan(slow.fighters[0].balance);
  });
  it.each(['closedGuard', 'halfGuard', 'openGuard', 'sideControl', 'mount', 'backControl', 'turtle', 'groundScramble'] as PositionId[])('preserves the connected relationship in %s', position => {
    const s = match(position); advance(s, 5, { x: -1, y: 1 }, { x: 1, y: -1 }); const a = s.fighters[0], b = s.fighters[1]; expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(positions[position].separation, 0); expect(s.top).toBe(0);
  });
  it('rejects impossible graph transitions', () => { const s = match(); expect(transition(s, 'mount', 0, 0)).toBe(false); expect(s.position).toBe('standing'); });
  it('all positions are reachable from neutral standing', () => {
    const seen = new Set<PositionId>(); const visit = (p: PositionId): void => { if (seen.has(p)) return; seen.add(p); positions[p].connections.forEach(visit); }; visit('standing'); expect(seen.size).toBe(Object.keys(positions).length);
  });
});
describe('committed techniques, defenses, and grappling', () => {
  it('rejects a takedown outside range without spending stamina', () => { const s = match(); expect(startAction(s, 0, 'doubleLeg')).toBe(false); expect(s.fighters[0].stamina).toBe(100); });
  it('scores a successful takedown only after settling the scramble', () => {
    const s = match('clinch'); expect(startAction(s, 0, 'doubleLeg')).toBe(true); advance(s, 1.2); expect(s.position).toBe('takedownScramble'); expect(s.score[0]).toBe(0); advance(s, 1); expect(s.position).toBe('closedGuard'); expect(s.top).toBe(0); expect(s.score[0]).toBe(0); advance(s, 3); expect(s.score[0]).toBe(2);
  });
  it('a shot fails against a timed defensive response', () => {
    const s = match('clinch'); startAction(s, 0, 'doubleLeg'); advance(s, 0.2); advance(s, STEP, {}, { defend: true }); advance(s, 1.8); expect(s.position).toBe('clinch'); expect(s.fighters[1].defenses).toBe(1); expect(s.score).toEqual([0, 0]);
  });
  it('a late sprawl contests the takedown scramble', () => {
    const s = match('clinch'); startAction(s, 0, 'doubleLeg'); advance(s, 1.05); expect(s.scramble).not.toBeNull(); advance(s, STEP, {}, { defend: true }); advance(s, 1); expect(s.position).toBe('clinch'); expect(s.score[0]).toBe(0);
  });
  it('rejects a shot facing away from the opponent', () => {
    const s = match('clinch'); startAction(s, 0, 'doubleLeg'); advance(s, 2, { face: Math.PI }); expect(s.position).toBe('clinch'); expect(s.events.some(e => e.kind === 'failed')).toBe(true);
  });
  it('guard pull gives the opponent top, without takedown points', () => { const s = match('clinch'); action(s, 0, 'pullGuard'); expect(s.position).toBe('closedGuard'); expect(s.top).toBe(1); advance(s, 4); expect(s.score).toEqual([0, 0]); });
  it('can pass, mount, and take the back with state-dependent control', () => {
    const s = match('closedGuard'); action(s, 0, 'pass'); expect(s.position).toBe('sideControl'); advance(s, 3); expect(s.score[0]).toBe(3);
    action(s, 0, 'mount'); expect(s.position).toBe('mount'); expect(s.fighters[0].control).toBeGreaterThan(0.8); advance(s, 3); expect(s.score[0]).toBe(7);
    action(s, 0, 'takeBack'); expect(s.position).toBe('backControl'); advance(s, 3); expect(s.score[0]).toBe(11);
  });
  it('a sweep inverts the top role but must be stabilized to score', () => {
    const s = match('closedGuard', 1); action(s, 0, 'sweep'); expect(s.position).toBe('groundScramble'); expect(s.top).toBe(0); advance(s, 4); expect(s.score[0]).toBe(0); action(s, 0, 'secure'); advance(s, 3); expect(s.score[0]).toBe(2);
  });
  it('escapes dominant control through legal connected states', () => { const s = match('mount', 1); action(s, 0, 'escape'); expect(s.position).toBe('halfGuard'); expect(s.top).toBe(1); expect(s.score[0]).toBe(0); });
  it('can transition guard, enter turtle, recover and stand', () => {
    const s = match('sideControl', 1); action(s, 0, 'turtle'); expect(s.position).toBe('turtle'); action(s, 0, 'roll'); expect(s.position).toBe('openGuard'); action(s, 0, 'closeGuard'); expect(s.position).toBe('closedGuard'); action(s, 0, 'halfGuard'); expect(s.position).toBe('halfGuard'); action(s, 0, 'openGuard'); action(s, 0, 'stand'); advance(s, 1); expect(s.position).toBe('standing'); expect(s.score[0]).toBe(0);
  });
  it('committed actions spend stamina and repeated presses do not produce repeated techniques', () => {
    const s = match('closedGuard'); startAction(s, 0, 'pass'); const stamina = s.fighters[0].stamina; for (let i = 0; i < 10; i++) startAction(s, 0, 'pass'); expect(s.fighters[0].stamina).toBe(stamina); expect(s.fighters[0].attempts).toBe(1); advance(s, 4); expect(s.fighters[0].attempts).toBe(1); expect(s.position).toBe('sideControl');
  });
  it('buffers a legal follow-up and revalidates it in the new position', () => {
    const s = match('sideControl'); startAction(s, 0, 'mount'); startAction(s, 0, 'submit'); advance(s, 2.5); expect(s.position).toBe('mount'); expect(s.submission?.actor).toBe(0); expect(s.fighters[0].attempts).toBe(2);
  });
  it('simultaneous techniques resolve to one consistent role and interrupt the loser', () => {
    const s = match('closedGuard'); startAction(s, 0, 'pass'); startAction(s, 1, 'sweep'); advance(s, 2); expect(s.top).toBe(1); expect(s.position).toBe('groundScramble'); expect(s.actions).toEqual([null, null]); expect(s.events.some(e => e.outcome === 'interrupted')).toBe(true);
  });
  it('stamina recovers through pauses and cannot go below zero', () => { const s = match('clinch'); startAction(s, 0, 'singleLeg'); const spent = s.fighters[0].stamina; advance(s, 5); expect(s.fighters[0].stamina).toBeGreaterThan(spent); advance(s, 30, { defend: true }); expect(s.fighters[0].stamina).toBeGreaterThanOrEqual(0); });
  it('never offers illegal actions for the current role or position', () => {
    const standing = match(); expect(availableTechniques(standing, 0).some(t => t.id === 'submit')).toBe(false);
    const guard = match('closedGuard'); expect(availableTechniques(guard, 0).some(t => t.id === 'submit')).toBe(false); expect(availableTechniques(guard, 1).some(t => t.id === 'pass')).toBe(false);
    const mount = match('mount'); expect(availableTechniques(mount, 1).some(t => t.id === 'submit')).toBe(false); expect(startAction(mount, 1, 'submit')).toBe(false);
  });
});
describe('submissions, timer, and scoring validation', () => {
  it('an attacker can finish a sustained eligible submission', () => { const s = match('mount'); action(s, 0, 'submit'); expect(s.submission).not.toBeNull(); advance(s, 12, { hold: true }); expect(s.result?.winner).toBe(0); expect(s.result?.method).toBe('Submission'); });
  it('active defense escapes the control contest', () => { const s = match('mount', 1); action(s, 1, 'submit'); advance(s, 4, { defend: true }, { hold: true }); expect(s.submission).toBeNull(); expect(s.result).toBeNull(); expect(s.fighters[0].defenses).toBeGreaterThan(0); });
  it('letting go of an attack does not automatically finish a submission', () => { const s = match('mount'); action(s, 0, 'submit'); advance(s, 5, {}, { defend: true }); expect(s.result).toBeNull(); expect(s.submission).toBeNull(); });
  it('a voluntary tap ends the match once and preserves the log', () => { const s = match(); advance(s, STEP, { tap: true }); advance(s, 5); expect(s.result?.winner).toBe(1); expect(s.result?.method).toBe('Tap'); expect(s.events.filter(e => e.kind === 'ended')).toHaveLength(1); });
  it('scores are canceled when the required stabilized state is lost', () => { const s = match('closedGuard'); action(s, 0, 'pass'); action(s, 1, 'escape'); advance(s, 5); expect(s.position).toBe('halfGuard'); expect(s.score).toEqual([0, 0]); });
  it('no duplicate score is emitted while holding the same mount', () => { const s = match('sideControl'); action(s, 0, 'mount'); advance(s, 20); expect(s.score[0]).toBe(4); expect(s.events.filter(e => e.kind === 'score')).toHaveLength(1); });
  it('points are rejected when the acting fighter is not on top', () => { const s = match('mount', 1); queueScore(s, 0, 'mount'); advance(s, 5); expect(s.score[0]).toBe(0); });
  it('regulation ends by points, with a draw for equal scores', () => {
    const s = createMatch(fighters[0], passive, { duration: 5, cpu: false, startPosition: 'mount' }); queueScore(s, 0, 'mount'); advance(s, 5.1); expect(s.result?.winner).toBe(0); expect(s.result?.method).toBe('Points'); expect(s.remaining).toBe(0);
    const tied = createMatch(fighters[0], passive, { duration: 5, cpu: false }); advance(tied, 5.1); expect(tied.result?.winner).toBeNull(); expect(tied.result?.method).toBe('Draw');
  });
  it('training has no clock, score or regulation result', () => { const s = createMatch(fighters[0], passive, { duration: 1, training: true }); advance(s, 3); expect(s.result).toBeNull(); expect(s.score).toEqual([0, 0]); });
  it('a new match resets every gameplay resource, input buffer and event ID', () => { const s = match('mount'); action(s, 0, 'submit'); advance(s, 12, { hold: true }); const next = match(); expect(next.score).toEqual([0, 0]); expect(next.result).toBeNull(); expect(next.submission).toBeNull(); expect(next.actions).toEqual([null, null]); expect(next.buffers).toEqual([null, null]); expect(next.events[0].id).toBe(1); expect(next.time).toBe(0); expect(next.fighters.every(f => f.stamina === 100)).toBe(true); });
});
describe('tactical CPU and reproducibility', () => {
  it.each(['pressure', 'defensive', 'wrestler', 'guard', 'balanced'] as Style[])('%s AI can act and finish a full unattended match', style => {
    const s = createMatch(fighters[0], { ...fighters[1], style }, { duration: 90 });
    for (let i = 0; i < 90 * 60 + 10 && !s.result; i++) tick(s, [idleInput(), cpuInput(s)]);
    expect(s.result).not.toBeNull(); expect(s.fighters[1].attempts).toBeGreaterThan(0); expect(s.fighters[1].distanceTravelled).toBeGreaterThan(20);
    expect(s.events.filter(e => e.kind === 'ended')).toHaveLength(1); expect(s.fighters.every(f => Number.isFinite(f.x) && Number.isFinite(f.y))).toBe(true);
  });
  it('the CPU can submit an inactive player from a dominant position', () => {
    const s = createMatch(fighters[0], fighters[2], { startPosition: 'mount', startTop: 1, duration: 60 });
    for (let i = 0; i < 60 * 60 && !s.result; i++) tick(s, [idleInput(), cpuInput(s)]);
    expect(s.result?.winner).toBe(1); expect(s.result?.method).toBe('Submission');
  });
  it('passive training partners allow controlled practice without attacking', () => { const s = createMatch(fighters[0], passive, { training: true, startPosition: 'clinch' }); for (let i = 0; i < 600; i++) tick(s, [idleInput(), cpuInput(s)]); expect(s.fighters[1].attempts).toBe(0); });
  it('identical seeds and fixed-timestep inputs produce identical outcomes', () => {
    const run = (): MatchState => { const s = createMatch(fighters[0], fighters[1], { seed: 291, duration: 40 }); for (let i = 0; i < 2401; i++) tick(s, [{ ...idleInput(), x: i < 30 ? 1 : 0 }, cpuInput(s)]); return s; };
    expect(run()).toEqual(run());
  });
  it('a full five-minute match remains finite, bounded, and event IDs are unique', () => {
    const s = createMatch(fighters[0], fighters[3], { duration: 300, startPosition: 'closedGuard', startTop: 0, difficulty: 'advanced' });
    for (let i = 0; i < 18001 && !s.result; i++) tick(s, [{ ...idleInput(), defend: true }, cpuInput(s)]);
    expect(s.result).not.toBeNull(); expect(s.time).toBeLessThanOrEqual(301); expect(s.fighters.every(f => f.stamina >= 0 && f.stamina <= 100 && Number.isFinite(f.control))).toBe(true);
    expect(new Set(s.events.map(e => e.id)).size).toBe(s.events.length); expect(s.events.length).toBeLessThan(2000);
  });
});
