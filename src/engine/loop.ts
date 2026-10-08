import { cpuInput } from '../ai/controller';
import { STEP, tick } from '../combat/simulation';
import type { MatchState } from '../combat/types';
import type { InputController } from './input';
export class GameLoop {
  private frame = 0;
  private last = 0;
  private accumulator = 0;
  paused = false;
  simMs = 0;
  fps = 60;
  constructor(public state: MatchState, private input: InputController, private draw: (s: MatchState, alpha: number) => void, private update: (s: MatchState) => void) {}
  start(): void { this.last = performance.now(); this.frame = requestAnimationFrame(this.run); }
  stop(): void { cancelAnimationFrame(this.frame); this.input.clear(); }
  setPaused(paused: boolean): void { this.paused = paused; this.accumulator = 0; this.input.clear(); this.last = performance.now(); }
  private run = (now: number): void => {
    const elapsed = Math.max(0, (now - this.last) / 1000); this.last = now;
    this.fps += ((elapsed ? 1 / elapsed : 60) - this.fps) * 0.08;
    if (!this.paused && !this.state.result) {
      this.accumulator += elapsed;
      const begin = performance.now();
      while (this.accumulator + 1e-9 >= STEP) { tick(this.state, [this.input.sample(this.state), cpuInput(this.state)]); this.accumulator = Math.max(0, this.accumulator - STEP); }
      this.simMs += (performance.now() - begin - this.simMs) * 0.08;
    }
    this.draw(this.state, this.accumulator / STEP); this.update(this.state);
    this.frame = requestAnimationFrame(this.run);
  };
}
