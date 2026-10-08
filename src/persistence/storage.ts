import type { MatchState, Result } from '../combat/types';
export interface SavedResult { id: string; date: string; player: string; opponent: string; result: Result; attempts: [number, number]; successes: [number, number]; defenses: [number, number]; events: MatchState['events'] }
function validResult(x: SavedResult): boolean {
  return !!x && typeof x.player === 'string' && typeof x.opponent === 'string' && typeof x.date === 'string' &&
    !!x.result && [0, 1, null].includes(x.result.winner) && ['Submission', 'Points', 'Draw', 'Tap'].includes(x.result.method) &&
    Number.isFinite(x.result.time) && Array.isArray(x.result.score) && x.result.score.length === 2 && x.result.score.every(n => Number.isFinite(n) && n >= 0) &&
    Array.isArray(x.events) && x.events.every(e => e && typeof e.text === 'string' && typeof e.kind === 'string' && Number.isFinite(e.time));
}
export function readResults(): SavedResult[] {
  try { const data = JSON.parse(localStorage.getItem('combat-legacy-results-v1') ?? '[]'); return Array.isArray(data) ? data.filter(validResult).slice(0, 30) : []; } catch { return []; }
}
export function saveResult(s: MatchState): boolean {
  if (!s.result || s.config.training) return true;
  try {
    const result: SavedResult = { id: crypto.randomUUID(), date: new Date().toISOString(), player: s.fighters[0].profile.name, opponent: s.fighters[1].profile.name, result: s.result, attempts: [s.fighters[0].attempts, s.fighters[1].attempts], successes: [s.fighters[0].successes, s.fighters[1].successes], defenses: [s.fighters[0].defenses, s.fighters[1].defenses], events: s.events };
    localStorage.setItem('combat-legacy-results-v1', JSON.stringify([result, ...readResults()].slice(0, 30))); return true;
  } catch { return false; }
}
