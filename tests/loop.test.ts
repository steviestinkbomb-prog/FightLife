import { afterEach, expect, it, vi } from 'vitest';
import { GameLoop } from '../src/engine/loop';
import { createMatch } from '../src/combat/simulation';
import { fighters } from '../src/data/fighters';
import { idleInput } from '../src/combat/types';
import type { InputController } from '../src/engine/input';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function harness(): { loop: GameLoop; frame: (time: number) => void } {
  let callback: FrameRequestCallback;
  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { callback = f; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const input = { sample: () => ({ ...idleInput(), y: -1 }), clear: vi.fn() } as unknown as InputController;
  const loop = new GameLoop(createMatch(fighters[0], fighters[1], { cpu: false }), input, vi.fn(), vi.fn());
  loop.start(); return { loop, frame: (time: number) => callback(time) };
}
it('render cadence and a long visible frame hitch do not alter the fixed-timestep simulation', () => {
  const regular = harness(); for (let i = 1; i <= 60; i++) regular.frame(i * 1000 / 60);
  const irregular = harness(); for (const time of [17, 100, 430, 900, 1000]) irregular.frame(time);
  expect(irregular.loop.state.time).toBeCloseTo(1, 8); expect(irregular.loop.state).toEqual(regular.loop.state);
});
it('pausing freezes simulation and resumes without catching up paused time', () => {
  const h = harness(); h.frame(100); h.loop.setPaused(true); h.frame(3000); expect(h.loop.state.time).toBeCloseTo(0.1, 8);
  vi.mocked(performance.now).mockReturnValue(3000); h.loop.setPaused(false); h.frame(3100); expect(h.loop.state.time).toBeCloseTo(0.2, 8);
});
