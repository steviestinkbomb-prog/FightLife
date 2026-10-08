import { fighters } from '../data/fighters';
import { positions } from '../data/positions';
import { contextualTechniques } from '../data/techniques';
import { createMatch, startAction } from '../combat/simulation';
import type { Difficulty, FighterId, MatchConfig, MatchState, PositionId, Style } from '../combat/types';
import { ArenaRenderer } from '../animation/renderer';
import { GameLoop } from '../engine/loop';
import { defaultBindings, InputController, keyLabel } from '../engine/input';
import { readResults, saveResult } from '../persistence/storage';
const arrow = '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 19 19 5M5 5h14v14"/></svg>';
const clock = (n: number): string => `${Math.floor(n / 60).toString().padStart(2, '0')}:${Math.floor(n % 60).toString().padStart(2, '0')}`;
const escapeHTML = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export class App {
  private loop: GameLoop | null = null;
  private input: InputController;
  private renderer: ArenaRenderer;
  private player = 0;
  private opponent = 1;
  private difficulty: Difficulty = 'beginner';
  private duration = 180;
  private training = false;
  private startPosition: PositionId = 'standing';
  private startTop: FighterId = 0;
  private trainingStyle: Style | 'default' = 'default';
  private latestConfig: Partial<MatchConfig> = {};
  private actionSignature = '';
  private saved = false;
  private resultStored = false;
  private lastHUD = 0;
  constructor(private root: HTMLElement) {
    root.innerHTML = `
      <header class="topbar"><a class="brand" href="#" aria-label="Combat Legacy home"><span class="brandmark">C<span>/</span>L</span><span>COMBAT<br><b>LEGACY</b></span></a><div class="topbar-center">THE ART OF THE EXCHANGE</div><div class="build-tag"><i></i> OFFLINE PLAY <span>V 0.1</span></div></header>
      <div class="shell"><aside class="sidebar"><p class="nav-label">YOUR CORNER</p><nav><button data-nav="play" class="nav-item active"><span>◈</span> Play <b>01</b></button><button data-nav="training" class="nav-item"><span>◎</span> Training <b>02</b></button><button data-nav="history" class="nav-item"><span>▤</span> Match history <b>03</b></button><button data-nav="controls" class="nav-item"><span>⌘</span> Controls <b>04</b></button></nav><div class="sidebar-bottom"><span class="chapter-label">THE FIRST CHAPTER</span><strong>Ground<br>zero.</strong><p>Every legacy begins<br>on the mat.</p><div class="chapter-tag">BJJ <span>/</span> NO-GI</div><button data-nav="about" class="text-link">Development notes ${arrow}</button></div></aside>
      <main><section id="home-view" class="view"><div class="page-heading"><div><p class="eyebrow">PLAY / QUICK MATCH</p><h1>On the mat.</h1></div><span class="small-tag">LOCAL PLAY · CPU OPPONENT</span></div><div class="hero"><div class="hero-copy"><div class="live-label"><i></i> FIRST PLAYABLE · BRAZILIAN JIU-JITSU</div><h2>POSITION.<br>PRESSURE.<br><em>LEGACY.</em></h2><p>Win the exchange. Find your opening.<br>Make your next move matter.</p><button class="button primary" id="quick-match">Quick match <span>→</span></button><div class="hero-detail"><span>01 MAT</span><span>04 FIGHTERS</span><span>REAL-TIME GRAPPLING</span></div></div><div class="hero-art"><canvas id="demo-canvas" aria-label="Overhead grappling arena with two articulated fighters"></canvas><div class="arena-caption"><span>THE NORTHSIDE OPEN</span><b>MAT 01 <i>●</i></b></div><div class="arena-footer"><span>CONTROL THE POSITION.<br>CONTROL THE MATCH.</span><b>CL / 001</b></div></div></div><div class="section-label"><span>BUILD YOUR GAME</span><span>A LITTLE PRACTICE. A LOT OF POSSIBILITIES.</span></div><div class="feature-grid"><button class="feature-card" data-nav="training"><div class="card-number">01 / PRACTICE</div><span class="card-icon">◎</span><h3>Find your flow.</h3><p>Start in any position. Learn the timing.<br>No clock. No pressure.</p><div class="card-link">Enter training ${arrow}</div></button><button class="feature-card" data-nav="history"><div class="card-number">02 / YOUR RECORD</div><span class="card-icon">▤</span><h3>Every exchange counts.</h3><p>Match results and event timelines.<br>Your progress, saved on this device.</p><div class="card-link">View match history ${arrow}</div></button><button class="feature-card" data-nav="controls"><div class="card-number">03 / THE FUNDAMENTALS</div><span class="card-icon">⌘</span><h3>Know your moves.</h3><p>Movement, pressure, and defense.<br>Get comfortable with your controls.</p><div class="card-link">Explore controls ${arrow}</div></button></div><footer class="page-footer"><span>MADE FOR THE LOVE OF GRAPPLING.</span><span>PHASE 01 <i>—</i> THE FOUNDATION</span></footer></section>
      <section id="match-view" class="view hidden"><div class="match-toolbar"><button id="leave-match" class="text-link">← Leave match</button><span id="match-type">NORTHSIDE OPEN / ADULT NO-GI</span><button id="pause-button" class="text-link">Pause <kbd>Esc</kbd></button></div><div class="scoreboard"><div class="fighter-hud player"><div class="fighter-meta"><span id="player-tag">YOU / NORTHSIDE JIU-JITSU</span><h2 id="player-name"></h2><div class="stamina-row"><span>STAMINA</span><b id="stamina-value-0">100%</b></div><div class="stamina-track"><i id="stamina-0"></i></div></div><div class="score" id="score-0">0</div></div><div class="clock-block"><span id="clock-label">REGULATION</span><strong id="clock">03:00</strong><small>NO-GI · POINTS</small></div><div class="fighter-hud opponent"><div class="score" id="score-1">0</div><div class="fighter-meta"><span id="opponent-tag">CPU / LOTUS GRAPPLING</span><h2 id="opponent-name"></h2><div class="stamina-row"><span>STAMINA</span><b id="stamina-value-1">100%</b></div><div class="stamina-track"><i id="stamina-1"></i></div></div></div></div><div class="arena-wrap"><canvas id="match-canvas" aria-label="Interactive BJJ match arena"></canvas><div class="position-badge"><i></i><span id="position-label">Neutral standing</span><small id="role-label">Standing</small></div><div id="hold-badge" class="hold-badge hidden"></div><div class="mat-stats"><span id="defense-state">Q · DEFEND</span><span id="performance"></span></div><div id="submission-panel" class="submission-panel hidden"><span id="submission-title"></span><div class="submission-track"><i id="submission-meter"></i></div><small id="submission-hint"></small></div><div id="pause-overlay" class="arena-overlay hidden"><div class="overlay-card"><p class="eyebrow">TAKE A BREATH</p><h2>In your corner.</h2><p>The match is paused. Your next move can wait.</p><button id="resume-match" class="button primary">Back to the mat →</button><button id="restart-match" class="button secondary">Restart match</button></div></div></div><div class="match-notice"><span class="referee-label">REFEREE</span><span id="match-notice"></span></div><div class="action-panel"><div class="action-header"><span>YOUR NEXT MOVE</span><button id="cycle-actions" class="text-link">More actions <kbd>R</kbd></button></div><div id="actions" class="action-grid"></div><div class="control-strip" id="control-strip"></div></div><div class="match-bottom"><span id="position-hint"></span><button id="timeline-button" class="text-link">Event timeline ${arrow}</button></div></section>
      <section id="other-view" class="view hidden"></section></main></div><div id="modal-root"></div>`;
    const canvas = this.get<HTMLCanvasElement>('match-canvas'); this.renderer = new ArenaRenderer(canvas); this.input = new InputController(canvas, (x, y) => this.renderer.screenToWorld(x, y));
    this.input.onPause = () => { if (this.loop && !this.loop.state.result && !this.loop.paused) this.pause(true); };
    root.querySelectorAll<HTMLElement>('[data-nav]').forEach(button => button.addEventListener('click', () => this.navigate(button.dataset.nav!)));
    root.querySelector('.brand')!.addEventListener('click', e => { e.preventDefault(); this.navigate('play'); });
    this.get('quick-match').onclick = () => this.setup(false);
    this.get('leave-match').onclick = () => this.navigate('play');
    this.get('pause-button').onclick = () => this.pause(!this.loop?.paused);
    this.get('resume-match').onclick = () => this.pause(false);
    this.get('restart-match').onclick = () => this.start(this.latestConfig);
    this.get('cycle-actions').onclick = () => { if (!this.loop) return; const options = contextualTechniques(this.loop.state, 0); this.input.selection = (this.input.selection + 1) % Math.max(1, Math.ceil(options.length / 3)); this.actionSignature = ''; this.updateHUD(this.loop.state, true); };
    this.get('timeline-button').onclick = () => this.timeline();
    window.addEventListener('keydown', e => {
      const dialog = this.root.querySelector<HTMLElement>('[role="dialog"]'); if (!dialog) return;
      if (e.code === 'Escape') { const close = dialog.querySelector<HTMLButtonElement>('.icon-button'); if (close) { e.preventDefault(); close.click(); } }
      if (e.code === 'Tab') {
        const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, [tabindex="0"]')];
        const first = items[0], last = items.at(-1); if (!first || !last) return;
        if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    });
    this.drawDemo();
  }
  private get<T extends HTMLElement = HTMLElement>(id: string): T { return this.root.querySelector(`#${id}`) as T; }
  private setView(id: string): void { for (const view of this.root.querySelectorAll('main > .view')) view.classList.toggle('hidden', view.id !== id); this.root.classList.toggle('in-match', id === 'match-view'); }
  private stop(): void { this.loop?.stop(); this.loop = null; this.input.enabled = false; this.input.clear(); }
  private navigate(nav: string): void {
    this.stop(); this.get('modal-root').innerHTML = ''; this.setView(nav === 'play' || nav === 'training' ? 'home-view' : 'other-view');
    this.root.querySelectorAll('[data-nav].nav-item').forEach(el => el.classList.toggle('active', (el as HTMLElement).dataset.nav === nav));
    if (nav === 'training') this.setup(true);
    if (nav === 'history') this.history(); if (nav === 'controls') this.controls(); if (nav === 'about') this.about();
  }
  private drawDemo(): void {
    const renderer = new ArenaRenderer(this.get<HTMLCanvasElement>('demo-canvas'));
    const demo = createMatch(fighters[0], fighters[1], { startPosition: 'closedGuard', training: true });
    const draw = (time: number): void => { if (!this.loop) { demo.time = time / 1000; demo.fighters[0].x = 490 + Math.sin(time / 1700) * 3; demo.fighters[1].x = 527 + Math.sin(time / 1700) * 3; renderer.draw(demo); } requestAnimationFrame(draw); }; requestAnimationFrame(draw);
  }
  private setup(training: boolean): void {
    this.training = training;
    const modal = this.get('modal-root');
    modal.innerHTML = `<div class="modal-backdrop"><section class="setup-dialog" role="dialog" aria-modal="true" aria-labelledby="setup-title"><div class="dialog-heading"><div><p class="eyebrow">${training ? 'THE PRACTICE ROOM' : 'NORTHSIDE OPEN / MATCH SETUP'}</p><h2 id="setup-title">${training ? 'Work on your game.' : 'Choose your corner.'}</h2></div><button class="icon-button" id="close-setup" aria-label="Close match setup">×</button></div><p class="dialog-intro">${training ? 'Choose a position and a training partner. All the mechanics, without the clock.' : 'Four athletes. Different strengths. The rest is up to you.'}</p><div class="picker-label">YOUR FIGHTER</div><div class="fighter-picker">${fighters.map((f, index) => `<button class="fighter-choice ${index === this.player ? 'selected' : ''}" data-fighter="${index}" style="--fighter-color:${f.color}"><div class="fighter-mini"><span class="mini-head" style="background:${f.skin}"></span><span class="mini-body"></span><span class="mini-leg left"></span><span class="mini-leg right"></span></div><small>${f.nickname.replace('THE ', '')}</small><strong>${f.name}</strong><span>${f.gym}</span></button>`).join('')}</div><div id="fighter-details" class="fighter-details"></div><div class="setup-options"><label>CPU OPPONENT<select id="opponent-select">${fighters.map((f, index) => `<option value="${index}" ${index === this.opponent ? 'selected' : ''}>${f.name} · ${f.style}</option>`).join('')}</select></label><label>DIFFICULTY<select id="difficulty-select"><option value="beginner">Beginner · learn the timing</option><option value="intermediate" ${this.difficulty === 'intermediate' ? 'selected' : ''}>Intermediate · reactive defense</option><option value="advanced" ${this.difficulty === 'advanced' ? 'selected' : ''}>Advanced · sharp counters</option></select></label>${training ? `<label>STARTING POSITION<select id="position-select">${Object.values(positions).filter(p => !['neutralRestart', 'takedownScramble'].includes(p.id)).map(p => `<option value="${p.id}" ${this.startPosition === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}</select></label><label>YOUR ROLE<select id="role-select"><option value="0">Top / attacking</option><option value="1" ${this.startTop === 1 ? 'selected' : ''}>Bottom / defending</option></select></label><label>PARTNER STYLE<select id="style-select"><option value="default">Fighter’s own style</option><option value="passive">Passive · technique practice</option><option value="pressure">Aggressive guard passer</option><option value="defensive">Defensive counter-wrestler</option><option value="wrestler">Takedown specialist</option><option value="guard">Guard specialist</option></select></label>` : `<label>MATCH LENGTH<select id="duration-select"><option value="180">3 minutes · quick match</option><option value="300" ${this.duration === 300 ? 'selected' : ''}>5 minutes · standard practice</option><option value="60" ${this.duration === 60 ? 'selected' : ''}>1 minute · short round</option></select></label>`}</div><div class="setup-footer"><span>${training ? 'PRACTICE · NO SCORING · NO RECORD' : 'ADULT NO-GI · POINTS · SUBMISSIONS'}<br><small>${training ? 'Finish or leave practice whenever you like.' : 'Takedown 2 / Sweep 2 / Pass 3 / Mount 4 / Back 4'}</small></span><button id="start-match" class="button primary">${training ? 'Enter training' : 'Step onto the mat'} →</button></div></section></div>`;
    this.get('close-setup').onclick = () => { modal.innerHTML = ''; };
    modal.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(button => button.onclick = () => { this.player = Number(button.dataset.fighter); modal.querySelectorAll('[data-fighter]').forEach(b => b.classList.toggle('selected', b === button)); this.fighterDetails(); });
    this.fighterDetails();
    this.get('start-match').onclick = () => {
      this.opponent = Number(this.get<HTMLSelectElement>('opponent-select').value);
      this.difficulty = this.get<HTMLSelectElement>('difficulty-select').value as Difficulty;
      if (training) { this.startPosition = this.get<HTMLSelectElement>('position-select').value as PositionId; this.startTop = Number(this.get<HTMLSelectElement>('role-select').value) as FighterId; this.trainingStyle = this.get<HTMLSelectElement>('style-select').value as Style | 'default'; }
      else this.duration = Number(this.get<HTMLSelectElement>('duration-select').value);
      modal.innerHTML = '';
      this.start({ training, difficulty: this.difficulty, duration: this.duration, startPosition: training ? this.startPosition : 'standing', startTop: training ? this.startTop : 0, seed: 42 });
    };
    this.get('start-match').focus();
  }
  private fighterDetails(): void {
    const f = fighters[this.player];
    this.get('fighter-details').innerHTML = `<p>${f.description}</p><div class="skill-row">${(['takedown', 'guard', 'passing', 'submission', 'cardio'] as const).map(skill => `<div><span>${skill.toUpperCase()}</span><b>${f.skills[skill]}</b><i style="--value:${f.skills[skill]}%;--fighter-color:${f.color}"></i></div>`).join('')}</div>`;
  }
  private start(config: Partial<MatchConfig>): void {
    this.stop(); this.latestConfig = config; this.saved = false; this.actionSignature = ''; this.lastHUD = 0; this.input.selection = 0;
    this.get('modal-root').innerHTML = ''; this.get('pause-overlay').classList.add('hidden'); this.get('pause-button').innerHTML = 'Pause <kbd>Esc</kbd>'; this.setView('match-view');
    const opponent = this.training && this.trainingStyle !== 'default' ? { ...fighters[this.opponent], style: this.trainingStyle } : fighters[this.opponent];
    const s = createMatch({ ...fighters[this.player], color: '#c7ee86' }, { ...opponent, color: '#ae9bff' }, config);
    for (const [id, f] of s.fighters.entries()) { this.get(id ? 'opponent-name' : 'player-name').textContent = f.profile.name; this.get(id ? 'opponent-tag' : 'player-tag').textContent = `${id ? 'CPU' : 'YOU'} / ${f.profile.gym.toUpperCase()}`; this.get(`stamina-${id}`).style.backgroundColor = f.profile.color; }
    this.get('match-type').textContent = config.training ? 'PRACTICE ROOM / SITUATIONAL TRAINING' : 'NORTHSIDE OPEN / ADULT NO-GI';
    this.get('clock-label').textContent = config.training ? 'FREE PRACTICE' : 'REGULATION';
    this.input.enabled = true;
    this.loop = new GameLoop(s, this.input, (state, alpha) => this.renderer.draw(state, alpha), state => this.updateHUD(state));
    this.updateHUD(s, true); this.loop.start();
    // Read-only inspection supports browser acceptance tests and local debugging.
    Object.defineProperty(window, '__combat', { configurable: true, get: () => this.loop ? structuredClone(this.loop.state) : null });
  }
  private pause(paused: boolean): void {
    if (!this.loop || this.loop.state.result) return;
    this.loop.setPaused(paused); this.input.enabled = !paused;
    this.get('pause-overlay').classList.toggle('hidden', !paused);
    this.get('pause-button').innerHTML = `${paused ? 'Resume' : 'Pause'} <kbd>Esc</kbd>`;
    if (paused) this.get('resume-match').focus();
  }
  private updateHUD(s: MatchState, force = false): void {
    if (!force && performance.now() - this.lastHUD < 70) return; this.lastHUD = performance.now();
    this.get('clock').textContent = s.config.training ? '∞' : clock(Math.ceil(s.remaining));
    for (const id of [0, 1] as FighterId[]) { this.get(`score-${id}`).textContent = String(s.score[id]); this.get(`stamina-value-${id}`).textContent = `${Math.round(s.fighters[id].stamina)}%`; this.get(`stamina-${id}`).style.width = `${s.fighters[id].stamina}%`; }
    const pos = positions[s.position]; this.get('position-label').textContent = pos.name; this.get('role-label').textContent = s.top === 0 ? pos.topLabel : pos.bottomLabel; this.get('position-hint').textContent = pos.hint;
    this.get('match-notice').textContent = s.lastMessage;
    const defense = s.fighters[0]; this.get('defense-state').textContent = defense.defenseUntil > s.time ? 'DEFENSE ACTIVE' : defense.defenseCooldown > s.time ? `DEFENSE RESET · ${(defense.defenseCooldown - s.time).toFixed(1)}s` : `${keyLabel(this.input.bindings.defend)} · DEFEND`;
    this.get('defense-state').classList.toggle('defense-active', defense.defenseUntil > s.time);
    this.get('performance').textContent = `60 Hz SIM · ${this.loop?.simMs.toFixed(1) ?? '0.0'} ms`;
    const pending = s.pendingScores[0]; this.get('hold-badge').classList.toggle('hidden', !pending);
    if (pending) this.get('hold-badge').textContent = `STABILIZE ${pending.kind.toUpperCase()} · ${pending.elapsed.toFixed(1)} / 3s`;
    this.get('submission-panel').classList.toggle('hidden', !s.submission);
    if (s.submission) { this.get('submission-title').textContent = s.submission.name; this.get('submission-meter').style.width = `${s.submission.progress * 100}%`; this.get('submission-hint').textContent = s.submission.actor === 0 ? `HOLD ${keyLabel(this.input.bindings.primary)} + MOVE TOWARD OPPONENT TO COMMIT` : `HOLD ${keyLabel(this.input.bindings.defend)} + MOVE AWAY TO ESCAPE · ${keyLabel(this.input.bindings.tap)} TO TAP`; }
    const options = contextualTechniques(s, 0); this.input.selection %= Math.max(1, Math.ceil(options.length / 3));
    const shown = options.slice(this.input.selection * 3, this.input.selection * 3 + 3);
    const signature = `${s.position}:${s.top}:${shown.map(t => t.id).join(',')}:${s.submission?.actor}:${!!s.actions[0]}:${s.result?.method}`;
    if (signature !== this.actionSignature) {
      this.actionSignature = signature;
      this.get('cycle-actions').classList.toggle('hidden', options.length <= 3);
      this.get('actions').innerHTML = shown.length ? shown.map((t, i) => `<button class="action-button ${s.actions[0]?.id === t.id ? 'committed' : ''}" data-action="${t.id}" title="${escapeHTML(t.description)}"><kbd>${keyLabel([this.input.bindings.primary, this.input.bindings.secondary, this.input.bindings.tertiary][i])}</kbd><div><strong>${t.short}</strong><small>${t.cost} ENERGY / ${t.duration.toFixed(1)}s COMMIT</small></div><span>→</span></button>`).join('') : `<div class="action-empty">${s.submission ? s.submission.actor === 0 ? 'Hold your primary action and apply pressure to finish the control contest.' : 'Stay composed. Hold defense and move away from the attacker.' : s.scramble ? 'A scramble is live — move to contest, Q to defend the entry.' : 'Close the distance to unlock an engagement. Face your opponent before committing.'}</div>`;
      this.get('actions').querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => button.onclick = () => { if (!this.loop?.paused) startAction(s, 0, button.dataset.action!); });
      const b = this.input.bindings;
      this.get('control-strip').innerHTML = `<span><kbd>${keyLabel(b.up)}${keyLabel(b.left)}${keyLabel(b.down)}${keyLabel(b.right)}</kbd> Move / pressure</span><span><kbd>${keyLabel(b.defend)}</kbd> Defend</span><span><kbd>${keyLabel(b.evade)}</kbd> Evade</span><span><kbd>${keyLabel(b.burst)}</kbd> Burst</span><span><kbd>${keyLabel(b.tap)}</kbd> Tap</span><span>Mouse · face / attack</span>`;
    }
    this.get('actions').querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = s.time < s.fighters[0].recoveryUntil || !!s.result; });
    if (s.result && !this.saved) { this.saved = true; const stored = saveResult(s); this.input.enabled = false; this.resultStored = stored; this.result(s, stored); }
  }
  private result(s: MatchState, stored: boolean): void {
    const result = s.result!; const winner = result.winner === null ? 'An even exchange.' : result.winner === 0 ? 'Your hand, raised.' : 'A lesson on the mat.';
    const name = result.winner === null ? 'Draw at the end of regulation' : `${s.fighters[result.winner].profile.name} wins by ${result.method.toLowerCase()}`;
    this.get('modal-root').innerHTML = `<div class="modal-backdrop result-backdrop"><section class="result-dialog" role="dialog" aria-modal="true" aria-labelledby="result-title"><p class="eyebrow">${s.config.training ? 'PRACTICE COMPLETE' : 'OFFICIAL MATCH RESULT'}</p><div class="result-emblem">${result.winner === 0 ? arrow : result.winner === null ? '=' : '↻'}</div><h2 id="result-title">${winner}</h2><p>${escapeHTML(name)}</p><div class="result-score"><span>${escapeHTML(s.fighters[0].profile.name)}<b>${s.score[0]}</b><small>YOU</small></span><i>—</i><span>${escapeHTML(s.fighters[1].profile.name)}<b>${s.score[1]}</b><small>CPU</small></span></div><div class="result-stats"><div><strong>${clock(result.time)}</strong><span>MATCH TIME</span></div><div><strong>${s.fighters[0].successes}/${s.fighters[0].attempts}</strong><span>COMPLETED ACTIONS</span></div><div><strong>${s.fighters[0].defenses}</strong><span>DEFENSES</span></div></div><p class="save-message">${s.config.training ? 'Practice results are not added to your record.' : stored ? 'Saved to your match history on this device.' : 'Device storage unavailable. This result could not be saved.'}</p><button id="rematch" class="button primary">Run it back →</button><button id="result-menu" class="button secondary">Back to menu</button><button id="result-timeline" class="text-link">Inspect event timeline ${arrow}</button></section></div>`;
    this.get('rematch').onclick = () => this.start(this.latestConfig);
    this.get('result-menu').onclick = () => this.navigate('play');
    this.get('result-timeline').onclick = () => this.timeline();
    this.get('rematch').focus();
  }
  private timeline(): void {
    if (!this.loop) return;
    const s = this.loop.state, wasPaused = this.loop.paused; if (!s.result) this.pause(true);
    const modal = this.get('modal-root');
    modal.innerHTML = `<div class="modal-backdrop"><section class="timeline-dialog" role="dialog" aria-modal="true" aria-labelledby="timeline-title"><div class="dialog-heading"><div><p class="eyebrow">THE EXCHANGE / MATCH EVENTS</p><h2 id="timeline-title">On the record.</h2></div><button id="close-timeline" class="icon-button" aria-label="Close timeline">×</button></div>${this.eventList(s.events)}</section></div>`;
    this.get('close-timeline').onclick = () => { modal.innerHTML = ''; if (s.result) this.result(s, this.resultStored); else if (!wasPaused) this.pause(false); };
  }
  private eventList(events: MatchState['events']): string { return `<ol class="event-list">${events.slice().reverse().map(e => `<li class="event-${e.kind}"><time>${clock(e.time)}</time><span class="event-kind">${e.kind.toUpperCase()}</span><p>${escapeHTML(e.text)}</p></li>`).join('')}</ol>`; }
  private history(): void {
    const data = readResults();
    this.get('other-view').innerHTML = `<div class="page-heading"><div><p class="eyebrow">YOUR RECORD / LOCAL HISTORY</p><h1>Every match matters.</h1></div><span class="small-tag">LAST 30 MATCHES · THIS DEVICE</span></div>${data.length ? `<div class="history-list">${data.map((r, i) => `<button class="history-row" data-result="${i}"><div class="history-outcome ${r.result.winner === 0 ? 'won' : ''}">${r.result.winner === null ? 'DRAW' : r.result.winner === 0 ? 'WIN' : 'LOSS'}</div><div><strong>${escapeHTML(r.player)} <span>vs</span> ${escapeHTML(r.opponent)}</strong><small>${new Date(r.date).toLocaleDateString()} · ${escapeHTML(r.result.method)} · ${clock(r.result.time)}</small></div><b>${r.result.score[0]} : ${r.result.score[1]}</b><span>↗</span></button>`).join('')}</div>` : `<div class="empty-state"><span>▤</span><h2>A clean slate.</h2><p>Your first match is the start of your story.<br>Play a quick match to build your record.</p><button id="history-play" class="button primary">Start a match →</button></div>`}`;
    const play = this.get('history-play'); if (play) play.onclick = () => this.setup(false);
    this.get('other-view').querySelectorAll<HTMLElement>('[data-result]').forEach(button => button.onclick = () => { const r = data[Number(button.dataset.result)]; this.get('modal-root').innerHTML = `<div class="modal-backdrop"><section class="timeline-dialog" role="dialog" aria-modal="true" aria-labelledby="saved-timeline-title"><div class="dialog-heading"><div><p class="eyebrow">SAVED MATCH / EVENT TIMELINE</p><h2 id="saved-timeline-title">${escapeHTML(r.player)} vs ${escapeHTML(r.opponent)}</h2></div><button id="close-record" class="icon-button" aria-label="Close saved match">×</button></div>${this.eventList(r.events)}</section></div>`; this.get('close-record').onclick = () => { this.get('modal-root').innerHTML = ''; }; });
  }
  private controls(): void {
    const descriptions: Record<string, string> = { up: 'Move forward / apply pressure', left: 'Move left', down: 'Move back / create space', right: 'Move right', primary: 'Primary action / hold for submission', secondary: 'Second contextual action', tertiary: 'Third contextual action', defend: 'Timed defense / submission resistance', engage: 'Establish standing clinch', cycle: 'Cycle contextual action page', burst: 'Movement burst (uses stamina)', evade: 'Defensive step (standing)', tap: 'Voluntary tap / concede match' };
    this.get('other-view').innerHTML = `<div class="page-heading"><div><p class="eyebrow">THE FUNDAMENTALS / INPUT SETTINGS</p><h1>Make it your own.</h1></div><span class="small-tag">KEYBOARD + STANDARD GAMEPAD</span></div><div class="controls-intro"><h2>Timing beats button mashing.</h2><p>Move with WASD or the arrow keys. Face with the mouse, or in your movement direction. Commit with J / K / L. Press Q after an opponent starts a technique to counter it. When grappling, movement applies pressure or creates space. In submissions, hold J to attack; hold Q and move away to defend.</p><p>Gamepad: left stick moves, A is the primary action, B is secondary, LB defends. Competitive matches run at normal speed. Escape pauses; leaving this tab also pauses the match.</p></div><div class="binding-grid">${Object.entries(this.input.bindings).map(([action, code]) => `<button class="binding-button" data-binding="${action}"><span>${descriptions[action]}</span><kbd>${keyLabel(code)}</kbd></button>`).join('')}</div><div class="settings-footer"><span id="binding-message">Click a binding, then press a new key. Settings are saved on this device.</span><button id="reset-bindings" class="button secondary">Restore defaults</button></div><div class="rules-note"><strong>READ THE EXCHANGE</strong><p>Green is your corner. Violet is the default opponent. The position badge identifies your role. A circular ring shows a committed action; the defense indicator shows your defensive window. Energy recovers when you release pressure. Use training to practice every position against a passive or tactical partner.</p></div>`;
    this.get('other-view').querySelectorAll<HTMLButtonElement>('[data-binding]').forEach(button => button.onclick = () => {
      this.get('binding-message').textContent = 'Press a new key. Escape cancels.'; button.classList.add('listening');
      const handler = (e: KeyboardEvent): void => { e.preventDefault(); if (e.code !== 'Escape') { if (this.input.rebind(button.dataset.binding!, e.code)) { button.querySelector('kbd')!.textContent = keyLabel(e.code); this.get('binding-message').textContent = 'Binding saved.'; } else this.get('binding-message').textContent = 'That key is already assigned. Choose another key.'; } button.classList.remove('listening'); };
      window.addEventListener('keydown', handler, { once: true });
    });
    this.get('reset-bindings').onclick = () => { this.input.bindings = { ...defaultBindings }; try { localStorage.removeItem('combat-legacy-bindings'); } catch { /* Optional storage. */ } this.controls(); };
  }
  private about(): void {
    this.get('other-view').innerHTML = `<div class="page-heading"><div><p class="eyebrow">DEVELOPMENT / THE ROAD AHEAD</p><h1>A foundation for a legacy.</h1></div><span class="small-tag">PHASE 01 · PLAYABLE PROTOTYPE</span></div><div class="notes"><h2>Build the match first.</h2><p>Combat Legacy begins with real-time no-gi grappling: twelve connected positions, contested techniques, readable athletes, tactical CPU opponents, interactive submissions, and a standalone scoring engine.</p><h3>The rules in this prototype</h3><p>Adult no-gi points inspired by common BJJ scoring: takedown and guard sweep 2, guard pass 3, mount and back with two hooks 4. Points require three seconds of stabilized control. A guard pull or non-guard reversal earns no points. Tied regulation matches are draws. This is a limited practice ruleset: advantages, penalties, referee decisions, belt/age restrictions, and full official event formats are not implemented.</p><h3>What comes next</h3><ol><li><b>Advanced BJJ:</b> deeper guards, gi grips, additional submissions, full documented competition rules.</li><li><b>Wrestling:</b> discipline-specific riding, exposure, pins, and periods.</li><li><b>MMA:</b> striking, cage wrestling, rounds, and judging.</li><li><b>Career world:</b> training progression, events, rankings, and an athletic lifetime.</li></ol><p>These later modes are future milestones. This build focuses on quick matches and situational training. All artwork is original procedural Canvas rendering. No licensed athlete likenesses or logos are used.</p></div>`;
  }
}
