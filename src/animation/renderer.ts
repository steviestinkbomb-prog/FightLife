import type { Fighter, FighterId, MatchState } from '../combat/types';
import { positions } from '../data/positions';
import { techniques } from '../data/techniques';
const TAU = Math.PI * 2;
interface Pose { headY: number; torsoY: number; torsoH: number; leftArm: number[][]; rightArm: number[][]; leftLeg: number[][]; rightLeg: number[][] }
interface RigCache { angle?: number; pose?: Pose }
function blendPose(previous: Pose | undefined, next: Pose): Pose {
  if (!previous) return next;
  const mix = (a: number, b: number): number => a + (b - a) * 0.22;
  const joints = (a: number[][], b: number[][]): number[][] => b.map((p, i) => [mix(a[i][0], p[0]), mix(a[i][1], p[1])]);
  return { headY: mix(previous.headY, next.headY), torsoY: mix(previous.torsoY, next.torsoY), torsoH: mix(previous.torsoH, next.torsoH), leftArm: joints(previous.leftArm, next.leftArm), rightArm: joints(previous.rightArm, next.rightArm), leftLeg: joints(previous.leftLeg, next.leftLeg), rightLeg: joints(previous.rightLeg, next.rightLeg) };
}
function line(c: CanvasRenderingContext2D, points: number[][], color: string, width: number): void {
  c.beginPath(); c.moveTo(points[0][0], points[0][1]); for (const p of points.slice(1)) c.lineTo(p[0], p[1]); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
function pill(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, color: string): void { c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill(); }
function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight = '500'): void { c.fillStyle = color; c.font = `${weight} ${size}px system-ui, sans-serif`; c.fillText(text, x, y); }
export function drawFighter(c: CanvasRenderingContext2D, f: Fighter, s: MatchState, id: FighterId, time: number, cache: RigCache = {}): void {
  const definition = positions[s.position], grounded = definition.grounded;
  const top = s.top === id, a = s.actions[id];
  let angle = f.angle;
  if (grounded && ['mount', 'backControl'].includes(s.position)) angle = s.positionAngle + Math.PI;
  if (grounded && s.position === 'sideControl' && top) angle += Math.PI / 2;
  if (cache.angle !== undefined) angle = cache.angle + Math.atan2(Math.sin(angle - cache.angle), Math.cos(angle - cache.angle)) * 0.18;
  cache.angle = angle;
  const walk = Math.sin(time * 13 + id * Math.PI) * Math.min(1, Math.hypot(f.vx, f.vy) / 70);
  const phase = a ? Math.sin(Math.min(1, a.elapsed / a.duration) * Math.PI) : 0;
  const extension = phase * 20;
  const color = f.profile.color, skin = f.profile.skin;
  c.save(); c.translate(f.x, f.y); c.rotate(angle + Math.PI / 2);
  c.shadowColor = '#0008'; c.shadowBlur = grounded ? 5 : 12; c.shadowOffsetY = grounded ? 3 : 7;
  c.fillStyle = '#0005'; c.beginPath(); c.ellipse(0, 8, grounded ? 26 : 20, grounded ? 42 : 35, 0, 0, TAU); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
  let headY = -25, torsoY = -17, torsoH = 31;
  let leftLeg = [[-8, 12], [-15, 28 + walk * 7], [-13, 43 + walk * 7]];
  let rightLeg = [[8, 12], [15, 28 - walk * 7], [13, 43 - walk * 7]];
  let leftArm = [[-12, -10], [-23, -7], [-17, -29 - extension]];
  let rightArm = [[12, -10], [23, -7], [17, -29 - extension]];
  if (s.position === 'clinch') { leftArm = [[-12, -10], [-22, -26], [-12, -42]]; rightArm = [[12, -10], [22, -26], [12, -42]]; }
  if (definition.pose === 'scramble') {
    torsoY += phase * 5; headY += 8;
    leftLeg = [[-8, 12], [-28, 21], [-34, 38]]; rightLeg = [[8, 12], [27, 15], [36, 27]];
    leftArm = [[-12, -10], [-29, -20], [-18, -38]]; rightArm = [[12, -10], [30, -16], [34, -34]];
  }
  if (grounded && !top && definition.pose === 'guard') {
    leftLeg = [[-8, 12], [-32, -4], [-23, -35]]; rightLeg = [[8, 12], [32, -4], [23, -35]];
    if (s.position === 'openGuard') { leftLeg = [[-8, 12], [-34, 8], [-42, -10]]; rightLeg = [[8, 12], [34, 8], [42, -10]]; }
    if (s.position === 'halfGuard') { leftLeg = [[-8, 12], [-22, -4], [-15, -27]]; rightLeg = [[8, 12], [18, 25], [29, 36]]; }
    leftArm = [[-12, -10], [-22, -20], [-15, -42]]; rightArm = [[12, -10], [22, -20], [15, -42]];
  } else if (grounded && top) {
    leftLeg = [[-8, 12], [-24, 22], [-31, 36]]; rightLeg = [[8, 12], [24, 22], [31, 36]];
    leftArm = [[-12, -10], [-24, -22], [-9, -35 - extension * 0.5]]; rightArm = [[12, -10], [24, -22], [9, -35 - extension * 0.5]];
  }
  if (grounded && (s.position === 'mount' || s.position === 'backControl')) {
    if (!top) { headY = -47; torsoY = -36; torsoH = 49; leftArm = [[-12, -25], [-26, -29], [-18, -42]]; rightArm = [[12, -25], [26, -29], [18, -42]]; }
    else { headY = -18; torsoY = -10; torsoH = 32; }
    if (s.position === 'backControl' && top) { leftLeg = [[-8, 12], [-28, 12], [-18, -6]]; rightLeg = [[8, 12], [28, 12], [18, -6]]; leftArm = [[-12, -10], [-28, -23], [8, -36]]; rightArm = [[12, -10], [24, -20], [-8, -34]]; }
  }
  if (s.position === 'turtle' && !top) {
    headY = -15; torsoY = -8; torsoH = 27;
    leftLeg = [[-8, 12], [-17, 23], [-13, 12]]; rightLeg = [[8, 12], [17, 23], [13, 12]];
    leftArm = [[-12, -6], [-20, -9], [-14, -20]]; rightArm = [[12, -6], [20, -9], [14, -20]];
  }
  if (s.submission && s.submission.actor === id) { leftArm = [[-12, -10], [-25, -25], [6, -36]]; rightArm = [[12, -10], [25, -25], [-6, -36]]; }
  if (f.defenseUntil > s.time && !grounded) { leftArm = [[-12, -10], [-26, -22], [-8, -35]]; rightArm = [[12, -10], [26, -22], [8, -35]]; }
  if (grounded && f.defenseUntil > s.time) {
    leftArm = [[-12, -10], [-27, -21], [-10, -37]]; rightArm = [[12, -10], [27, -21], [10, -37]];
  }
  const breathing = Math.sin(time * 3.5 + id) * 0.6;
  headY += breathing; torsoY += breathing;
  cache.pose = blendPose(cache.pose, { headY, torsoY, torsoH, leftArm, rightArm, leftLeg, rightLeg });
  ({ headY, torsoY, torsoH, leftArm, rightArm, leftLeg, rightLeg } = cache.pose);
  // Limbs use two articulated segments, with rashguards and shorts over a skin rig.
  for (const leg of [leftLeg, rightLeg]) { line(c, leg, '#131c20', 13); line(c, leg.slice(1), skin, 8); dot(c, leg[2][0], leg[2][1], 5, skin); }
  pill(c, -13, torsoY + torsoH - 6, 26, 15, 5, '#152027');
  pill(c, -13, torsoY, 26, torsoH, 9, color);
  pill(c, -3, torsoY + 2, 6, torsoH - 5, 3, '#ffffff18');
  for (const arm of [leftArm, rightArm]) { line(c, arm, skin, 8); line(c, arm.slice(0, 2), color, 10); dot(c, arm[2][0], arm[2][1], 4.7, skin); }
  dot(c, 0, headY + 4, 8.5, skin); dot(c, 0, headY, 10, '#352822');
  c.fillStyle = skin; c.beginPath(); c.ellipse(0, headY + 5, 8, 5, 0, 0, Math.PI); c.fill();
  line(c, [[-8, headY - 3], [0, headY - 6], [7, headY - 2]], '#1d1716', 3);
  c.restore();
  if (f.defenseUntil > s.time) {
    c.save(); c.strokeStyle = '#ddffaf66'; c.lineWidth = 2; c.beginPath(); c.arc(f.x, f.y, 46, 0, TAU); c.stroke(); c.restore();
  }
  if (a) {
    c.save(); c.strokeStyle = color + '99'; c.lineWidth = 2; c.beginPath(); c.arc(f.x, f.y, 49, -Math.PI / 2, -Math.PI / 2 + TAU * a.elapsed / a.duration); c.stroke(); c.restore();
  }
}
export class ArenaRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private zoom = 1;
  private cameraX = 500;
  private cameraY = 350;
  private rigs: [RigCache, RigCache] = [{}, {}];
  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas 2D is required.'); this.ctx = context;
  }
  screenToWorld(x: number, y: number): { x: number; y: number } {
    const scale = Math.min(this.width / 1000, this.height / 700) || 1;
    return { x: (x / 1000 * this.width - this.width / 2) / (scale * this.zoom) + this.cameraX, y: (y / 700 * this.height - this.height / 2) / (scale * this.zoom) + this.cameraY };
  }
  draw(s: MatchState, _alpha = 0): void {
    const rect = this.canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (w !== this.width || h !== this.height) { this.canvas.width = this.width = w; this.canvas.height = this.height = h; }
    if (!w || !h) return;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#101a1c'; c.fillRect(0, 0, w, h);
    const grounded = positions[s.position].grounded;
    this.zoom += ((grounded ? 1.55 : 1.12) - this.zoom) * 0.06;
    const centerX = grounded ? (s.fighters[0].x + s.fighters[1].x) / 2 : 500;
    const centerY = grounded ? (s.fighters[0].y + s.fighters[1].y) / 2 : 350;
    this.cameraX += (centerX - this.cameraX) * 0.06; this.cameraY += (centerY - this.cameraY) * 0.06;
    const scale = Math.min(w / 1000, h / 700);
    c.setTransform(scale, 0, 0, scale, w / 2 - scale * 500, h / 2 - scale * 350);
    c.translate(500, 350); c.scale(this.zoom, this.zoom); c.translate(-this.cameraX, -this.cameraY);
    c.fillStyle = '#101a1c'; c.fillRect(-500, -500, 2000, 1700);
    const glow = c.createRadialGradient(500, 350, 20, 500, 350, 530); glow.addColorStop(0, '#283b3b'); glow.addColorStop(1, '#10191b'); c.fillStyle = glow; c.fillRect(-500, -500, 2000, 1700);
    c.save(); c.globalAlpha = 0.5;
    for (let row = 0; row < 3; row++) for (let n = 0; n < 27; n++) {
      const x = 25 + n * 36, y = 28 + row * 17;
      dot(c, x, y, 4.5, n % 4 ? '#4b5352' : '#698076'); pill(c, x - 6, y + 5, 12, 9, 4, '#343f3e');
      dot(c, x, 700 - y, 4.5, '#4b5352');
    }
    c.restore();
    c.save(); c.shadowColor = '#0008'; c.shadowBlur = 28; c.shadowOffsetY = 15;
    pill(c, 82, 95, 836, 510, 5, '#405857'); c.restore();
    pill(c, 92, 105, 816, 490, 2, '#557573'); pill(c, 127, 140, 746, 420, 0, '#315452');
    // Actual surface texture, seams, and a fixed competition boundary.
    c.save(); c.strokeStyle = '#ffffff05'; c.lineWidth = 1;
    for (let x = 127; x <= 874; x += 62) { c.beginPath(); c.moveTo(x, 140); c.lineTo(x, 560); c.stroke(); }
    for (let y = 140; y <= 560; y += 60) { c.beginPath(); c.moveTo(127, y); c.lineTo(873, y); c.stroke(); }
    c.strokeStyle = '#bdd8b35c'; c.lineWidth = 2; c.strokeRect(147, 160, 706, 380);
    c.setLineDash([4, 9]); c.strokeStyle = '#b4d5c016'; c.beginPath(); c.arc(500, 350, 136, 0, TAU); c.stroke(); c.setLineDash([]);
    c.textAlign = 'center'; label(c, 'C / L', 500, 360, 72, '#b4d5c016', '800');
    label(c, 'COMBAT LEGACY', 500, 582, 12, '#dbeddd91', '700');
    label(c, 'N O R T H S I D E   /   M A T   0 1', 500, 125, 10, '#deebde91', '600'); c.restore();
    // Mat-side officiating character. This is presentation; the rules engine officiates.
    c.save(); c.translate(924, 310); dot(c, 0, -13, 7, '#be9778'); pill(c, -8, -6, 16, 23, 5, '#242b2c'); line(c, [[-4, 15], [-6, 37]], '#151a1b', 7); line(c, [[4, 15], [6, 37]], '#151a1b', 7); line(c, [[-8, 0], [-14, 15]], '#be9778', 5); line(c, [[8, 0], [14, 15]], '#be9778', 5); c.restore();
    const ground = positions[s.position].grounded;
    const order: FighterId[] = ground ? [s.top === 0 ? 1 : 0, s.top] : [0, 1];
    if (s.position !== 'standing' && s.position !== 'neutralRestart') {
      const a = s.fighters[0], b = s.fighters[1]; c.save(); c.strokeStyle = '#d9ecc636'; c.lineWidth = 3; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore();
    }
    for (const id of order) drawFighter(c, s.fighters[id], s, id, s.time, this.rigs[id]);
    for (const id of [0, 1] as FighterId[]) {
      const f = s.fighters[id]; c.save(); c.textAlign = 'center';
      if (id === 0) { c.fillStyle = f.profile.color; c.beginPath(); c.moveTo(f.x - 4, f.y - 63); c.lineTo(f.x + 4, f.y - 63); c.lineTo(f.x, f.y - 57); c.fill(); }
      if (!ground) { pill(c, f.x - 24, f.y + 53, 48, 14, 4, '#0b1617a6'); label(c, id === 0 ? 'YOU' : 'CPU', f.x, f.y + 63, 9, f.profile.color, '700'); }
      c.restore();
    }
    const active = s.actions.find(Boolean);
    if (active || s.submission) {
      c.save(); c.textAlign = 'center'; const text = s.submission ? s.submission.name.toUpperCase() : techniques[active!.id].name.toUpperCase();
      const textWidth = text.length * 7; pill(c, 500 - textWidth / 2 - 16, 177, textWidth + 32, 26, 4, '#101d1ce0'); label(c, text, 500, 194, 10, s.submission ? '#efbf85' : '#e2efdd', '600'); c.restore();
    }
    // Subtle vignette draws attention to the fighters.
    const vignette = c.createRadialGradient(500, 350, 230, 500, 350, 600); vignette.addColorStop(0, '#0000'); vignette.addColorStop(1, '#0006'); c.fillStyle = vignette; c.fillRect(-500, -500, 2000, 1700);
  }
}
