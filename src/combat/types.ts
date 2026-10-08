export type FighterId = 0 | 1;
export type PositionId = 'standing' | 'clinch' | 'takedownScramble' | 'closedGuard' | 'openGuard' | 'halfGuard' | 'sideControl' | 'mount' | 'backControl' | 'turtle' | 'groundScramble' | 'neutralRestart';
export type Style = 'balanced' | 'wrestler' | 'guard' | 'pressure' | 'defensive' | 'passive';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export interface Skills { takedown: number; defense: number; passing: number; guard: number; control: number; submission: number; cardio: number }
export interface Profile { id: string; name: string; nickname: string; gym: string; style: Style; color: string; skin: string; skills: Skills; description: string }
export interface Fighter { profile: Profile; x: number; y: number; vx: number; vy: number; angle: number; stamina: number; balance: number; control: number; momentum: number; defenseUntil: number; defenseStart: number; defenseCooldown: number; evadeUntil: number; recoveryUntil: number; distanceTravelled: number; attempts: number; successes: number; defenses: number; submissions: number }
export interface Input { x: number; y: number; sprint: boolean; defend: boolean; evade: boolean; action?: string; hold: boolean; tap: boolean; face?: number }
export const idleInput = (): Input => ({ x: 0, y: 0, sprint: false, defend: false, evade: false, hold: false, tap: false });
export interface ActiveAction { id: string; actor: FighterId; elapsed: number; duration: number; epoch: number; started: number; origin: PositionId; defended: boolean }
export interface Submission { actor: FighterId; progress: number; elapsed: number; name: string; origin: PositionId }
export interface MatchEvent { id: number; time: number; actor: FighterId | null; kind: 'started' | 'technique' | 'failed' | 'defended' | 'position' | 'score' | 'submission' | 'ended' | 'restart'; text: string; position: PositionId; outcome?: string }
export interface PendingScore { actor: FighterId; kind: 'takedown' | 'sweep' | 'pass' | 'mount' | 'back'; elapsed: number; position: PositionId }
export interface Result { winner: FighterId | null; method: 'Submission' | 'Points' | 'Draw' | 'Tap'; time: number; score: [number, number] }
export interface MatchConfig { duration: number; difficulty: Difficulty; seed: number; training: boolean; cpu: boolean; startPosition?: PositionId; startTop?: FighterId }
export interface MatchState { fighters: [Fighter, Fighter]; position: PositionId; top: FighterId; time: number; remaining: number; epoch: number; positionTime: number; positionAngle: number; score: [number, number]; actions: [ActiveAction | null, ActiveAction | null]; buffers: [string | null, string | null]; submission: Submission | null; pendingScores: PendingScore[]; events: MatchEvent[]; result: Result | null; config: MatchConfig; scramble: { actor: FighterId; remaining: number; defended: boolean } | null; rng: number; ai: { nextDecision: number; seenAction: string; seenAt: number; habits: Record<string, number>; targetX: number; targetY: number }; lastMessage: string }
