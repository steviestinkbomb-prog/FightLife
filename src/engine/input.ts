import { contextualTechniques } from '../data/techniques';
import { idleInput, type Input, type MatchState } from '../combat/types';
export const defaultBindings: Record<string, string> = { up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', primary: 'KeyJ', secondary: 'KeyK', tertiary: 'KeyL', defend: 'KeyQ', engage: 'KeyE', cycle: 'KeyR', burst: 'ShiftLeft', evade: 'Space', tap: 'KeyT' };
export const keyLabel = (code: string): string => code.replace('Key', '').replace('Digit', '').replace('ShiftLeft', 'Shift').replace('Space', 'Space');
export class InputController {
  keys = new Set<string>();
  pressed = new Set<string>();
  bindings = { ...defaultBindings };
  selection = 0;
  pointer: { x: number; y: number } | null = null;
  enabled = false;
  onPause: () => void = () => {};
  constructor(private canvas: HTMLCanvasElement, private toWorld: (x: number, y: number) => { x: number; y: number } = (x, y) => ({ x, y })) {
    try { this.bindings = { ...defaultBindings, ...JSON.parse(localStorage.getItem('combat-legacy-bindings') ?? '{}') }; } catch { /* Use safe defaults for damaged storage. */ }
    window.addEventListener('keydown', e => {
      if (!this.enabled || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Escape') { e.preventDefault(); if (!e.repeat) this.onPause(); return; }
      if (Object.values(this.bindings).includes(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.clear(); if (this.enabled) this.onPause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clear(); if (this.enabled) this.onPause(); } });
    canvas.addEventListener('pointermove', e => { const rect = canvas.getBoundingClientRect(); this.pointer = this.toWorld((e.clientX - rect.left) / rect.width * 1000, (e.clientY - rect.top) / rect.height * 700); });
    canvas.addEventListener('pointerleave', () => { this.pointer = null; });
    canvas.addEventListener('pointerdown', e => { if (this.enabled) { e.preventDefault(); this.pressed.add(e.button === 2 ? this.bindings.secondary : this.bindings.primary); this.keys.add(e.button === 2 ? this.bindings.secondary : this.bindings.primary); } });
    window.addEventListener('pointerup', () => { this.keys.delete(this.bindings.primary); this.keys.delete(this.bindings.secondary); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  clear(): void { this.keys.clear(); this.pressed.clear(); }
  rebind(action: string, code: string): boolean {
    if (code === 'Escape' || Object.entries(this.bindings).some(([key, value]) => key !== action && value === code)) return false;
    this.bindings[action] = code;
    try { localStorage.setItem('combat-legacy-bindings', JSON.stringify(this.bindings)); } catch { /* Storage is optional. */ }
    return true;
  }
  sample(s: MatchState): Input {
    const i = idleInput(), b = this.bindings;
    if (!this.enabled) { this.pressed.clear(); return i; }
    const held = (key: string, arrow?: string): boolean => this.keys.has(key) || !!arrow && this.keys.has(arrow);
    i.x = Number(held(b.right, 'ArrowRight')) - Number(held(b.left, 'ArrowLeft'));
    i.y = Number(held(b.down, 'ArrowDown')) - Number(held(b.up, 'ArrowUp'));
    i.sprint = held(b.burst); i.defend = held(b.defend); i.evade = this.pressed.has(b.evade); i.hold = held(b.primary); i.tap = this.pressed.has(b.tap);
    if (this.pointer) i.face = Math.atan2(this.pointer.y - s.fighters[0].y, this.pointer.x - s.fighters[0].x);
    const options = contextualTechniques(s, 0);
    if (this.pressed.has(b.cycle)) this.selection = (this.selection + 1) % Math.max(1, Math.ceil(options.length / 3));
    this.selection %= Math.max(1, Math.ceil(options.length / 3));
    for (const [index, key] of [b.primary, b.secondary, b.tertiary].entries()) if (this.pressed.has(key)) i.action = options[this.selection * 3 + index]?.id;
    if (this.pressed.has(b.engage) && options.some(t => t.id === 'engage')) i.action = 'engage';
    // Standard gamepad mapping shares this input layer; no gamepad-only simulation path.
    const pad = navigator.getGamepads?.()[0];
    if (pad) {
      if (Math.abs(pad.axes[0]) > 0.18) i.x = pad.axes[0];
      if (Math.abs(pad.axes[1]) > 0.18) i.y = pad.axes[1];
      i.hold ||= !!pad.buttons[0]?.pressed; i.defend ||= !!pad.buttons[4]?.pressed;
      if (pad.buttons[0]?.pressed && !s.actions[0] && s.time >= s.fighters[0].recoveryUntil) i.action = options[0]?.id;
      if (pad.buttons[1]?.pressed && !s.actions[0] && s.time >= s.fighters[0].recoveryUntil) i.action = options[1]?.id;
    }
    this.pressed.clear();
    return i;
  }
}
