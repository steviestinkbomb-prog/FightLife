import type { FighterId, MatchEvent, MatchState } from './types';
export function emit(s: MatchState, kind: MatchEvent['kind'], text: string, actor: FighterId | null = null, outcome?: string): void {
  s.events.push({ id: (s.events.at(-1)?.id ?? 0) + 1, time: s.time, actor, kind, text, position: s.position, outcome });
  s.lastMessage = text;
}
