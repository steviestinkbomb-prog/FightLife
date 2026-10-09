# COMBAT LEGACY

A playable browser BJJ prototype. Fight the exchange, not a progress bar.

The first milestone focuses on real-time movement, shared positional grappling, committed techniques, defense, tactical opponents, and complete matches. It is **not yet the full BJJ / wrestling / MMA career simulator** described in the development brief.

## Run locally

Install **Node.js 24 LTS** (Node 22.12+ also satisfies the tooling requirements), npm, and a current Chrome, Edge, or Firefox browser. No API keys, backend, database service, or external game assets are required.

```sh
npm ci
npm run dev
```

Open the development-server address printed by Vite. Click **Quick match**, choose both athletes and difficulty, and step onto the mat. The normal development server is required; do not launch `index.html` by double-clicking it.

```sh
npm run build       # Type checking and production bundle in dist/
npm run preview     # Serve the production build locally
npm test            # Deterministic combat and game-loop tests
npm run typecheck
```

### Windows: double-click to play

1. Install **Node.js 24 LTS** from the official Node.js website once.
2. Extract the **entire** project ZIP into a folder; do not run the launcher inside the ZIP preview.
3. Double-click **`START-COMBAT-LEGACY.cmd`**.

The launcher installs dependencies on the first run, starts the local game server, and automatically opens your default browser. First-run installation needs internet access; subsequent launches use the installed dependencies. Keep its console window open while playing; close it to stop the server. If the usual port is busy, Vite selects another available port and opens the correct address. Errors stay visible in the console.

Windows runs `.cmd` launchers directly. A custom `.start` extension would require a separate file association. The launcher calls `npm.cmd`, so it does not require changing PowerShell's execution policy.

### Windows / VS Code (manual alternative)

1. Install the Windows Node.js 24 LTS installer from the official Node.js website, then reopen your terminal.
2. Extract the source archive into a folder, or open the FightLife checkout in VS Code.
3. Open **Terminal → New Terminal** in the project folder.
4. Run `node --version`, `npm ci`, and `npm run dev`.
5. Open Vite's printed local address in your browser. Keep the terminal running while you play.

If PowerShell blocks `npm.ps1`, use `npm.cmd ci` and `npm.cmd run dev`, or choose VS Code's Command Prompt terminal. You do not need to weaken the machine's execution policy. This project was validated on Linux Chromium; Windows-specific launch behavior has not been executed in this environment.

### Browser tests

```sh
npx playwright install chromium
npm run test:browser
```

On Linux, the test configuration automatically uses `/usr/bin/chromium` if present. Otherwise it uses Playwright's installed Chromium. To select another compatible executable, set `CHROMIUM_PATH` before running the browser tests (PowerShell: `$env:CHROMIUM_PATH = 'C:\path\to\chrome.exe'`). Browser download destinations may require network allowlisting in restricted environments. There is no browser installation requirement just to play the game.

## Controls

| Input | Standing | Ground |
| --- | --- | --- |
| WASD / arrow keys / gamepad left stick | Move and face in your movement direction | Apply pressure or create space |
| Mouse movement | Face / target | Position-dependent facing |
| J / left mouse / gamepad A | First contextual action | First contextual action; **hold J** during an attacking submission |
| K / right mouse / gamepad B | Second contextual action | Second contextual action |
| L | Third contextual action | Third contextual action |
| Q / gamepad LB | Timed defense / sprawl | Contest a transition; **hold Q** during a defending submission |
| E | Establish clinch when eligible | — |
| R | Cycle extra action pages | Cycle extra action pages |
| Shift | Movement burst (uses stamina and balance) | — |
| Space | Defensive step | — |
| T | Voluntary tap / concede | Voluntary tap / concede |
| Escape | Pause | Pause |

Keyboard actions are rebindable from **Controls**. Bindings and completed quick-match results are saved on this device. Clearing browser site storage clears them. Losing focus or switching tabs pauses play. On-screen action buttons provide clickable alternatives to J/K/L; the game is keyboard-first, without touch movement controls.

### Your first exchange

- Use **Training** with a passive partner to learn the controls, then try Quick Match.
- Close the distance before engaging. Face toward the other fighter; a shot facing away or out of range fails.
- Watch the opponent's visible commitment ring. Press Q after their action starts for a timed counter. Defense has a recovery window; holding it preemptively is weaker.
- In closed guard, top can pass while bottom can sweep or attack. Options change with role, position, and available stamina. R reveals additional legal actions.
- Top can pass → side control → mount → back control. Bottom can frame, bridge, recover guard, turn to turtle, or stand from an eligible open position.
- In an eligible submission, hold J **and move toward the other fighter** to commit. The defender holds Q and moves away to escape. This is an abstract sports control contest, without graphic injury simulation.
- Rest between commitments. Low stamina makes offense and defense weaker. Spam inputs do not bypass recovery or make invalid techniques succeed.

Uniforms use corner colors: **lime player / violet CPU**, including mirror matches. The position badge identifies your top/bottom role. The three-second stabilization badge explains points that are pending, rather than pretending every successful animation immediately scores.

## Implemented

- Vite + strict TypeScript project; original Canvas 2D graphics, with no runtime network assets.
- Main menu, fighter and CPU selection, three reaction-based difficulty levels, quick matches of one, three, or five minutes, result screen and rematch.
- Four fictional athletes with different skills, styles, and identity; no real athlete likenesses or licensed logos.
- Fixed 60 Hz simulation separate from rendering, seeded AI choices, deterministic technique outcomes, stable match clocks, buffered and interruptible actions.
- Continuous movement, facing, acceleration, collisions, connected grappling constraints, boundary recentering, stamina, balance, control, momentum, and defensive recovery windows.
- **12 connected positions:** neutral standing, clinch, takedown scramble, closed guard, half guard, open guard, side control, mount, back control, turtle, ground scramble, and neutral restart.
- **19 registered actions:** clinch, double leg, single leg, guard pull, open guard, half-guard entry, guard recovery, guard pass, sweep, mount, back take, positional escape, bridge, turtle entry, roll to guard, top stabilization, stand-up, submission, and disengagement. Each has eligibility, duration, cost, outcome, and counter conditions.
- Articulated fighters with visible heads, torsos, arms, legs, corner uniforms, gait, action movement, blended poses, defensive feedback, and contextual camera zoom.
- Tactical CPU that moves, attacks, counters, conserves energy, selects role-appropriate actions, pursues submissions, and reacts to repeated committed attacks. Difficulty changes reaction/tactical behavior, not hidden skill bonuses.
- Practice starts in any ordinary combat position, from top or bottom, against passive, aggressive, defensive, wrestling, or guard-focused partners. Practice has no clock, points, or saved record; submissions/taps can finish practice.
- Standalone limited adult no-gi points rules; stabilization and role validation; submission, tap, points, or draw results; match statistics and uniquely numbered event timelines.
- Device-local history for the last 30 quick matches, keyboard rebinding, standard gamepad input, responsive layouts, pause, dialog keyboard focus handling, and graceful storage failure messages.

## Rules and known limitations

The prototype uses a **limited practice ruleset**, not a complete or certified implementation of IBJJF, ADCC, or any official tournament format.

| Event | Points | Condition |
| --- | --- | --- |
| Takedown | 2 | Legal entry, successful contested scramble, then three seconds on top in a settled ground position |
| Guard sweep | 2 | Bottom guard transitions to top, then stabilizes in a settled ground position for three seconds |
| Guard pass | 3 | Clear a guard into side control and hold that position for three seconds |
| Mount | 4 | Establish and hold mount for three seconds |
| Back | 4 | Establish the back-control pose with both hooks and hold for three seconds |

A guard pull, a non-guard reversal, or a stand-up earns no points. Pending points are canceled if the scoring role or required position is lost. Regulation ends on points, or a draw when scores are equal. Boundary recentering preserves ground position and roles. There are no striking actions or injury-producing visual effects.

Not implemented: advantages, accumulated penalties, official tie-breaking referee decisions, legal-technique division matrices, stalling rules, full referee pause/restart procedures, official ADCC/IBJJF configurations, gi grips, advanced leg entanglements, striking, wrestling competition rules, career progression, tournaments, character creator, an NPC world, match replay playback, audio, multiplayer, advanced gamepad rebinding, or controller vibration. The event history is a timeline, not a reconstructable replay. Match history uses versioned localStorage, not IndexedDB or cloud sync. Art and movement are procedural prototype rigs, not biomechanically exact motion capture.

The official IBJJF reference (`https://ibjjf.com/books-videos`) could not be fetched in this cloud environment: the request returned HTTP 403. Exact official rules and current division restrictions must be researched and verified before the later official competition modes are implemented. No claim of full official rules compliance is made.

## Architecture

```text
src/
  engine/       Fixed-timestep loop, keyboard/mouse/gamepad input
  combat/       Shared state, geometry, actions, contests, event emission
  data/         Fighter profiles, position graph, technique registry
  rules/        Scoring stabilization and match-ending logic
  ai/           Visible-state tactical opponent controller
  animation/    Arena, articulated rigs, pose blending, camera mapping
  ui/           Menu, setup, HUD, settings, history, results, responsive CSS
  persistence/  Versioned local results and safe storage access
 tests/
  combat.test.ts   Movement, transitions, techniques, rules, AI, long matches
  loop.test.ts     Render-cadence independence and pause/resume behavior
  browser.spec.ts Real UI, keyboard combat, AI result, persistence, rebinding
```

Technique outcomes use current geometry, facing, skills, stamina, balance, control, directional pressure, and visible defensive timing. AI tie-breaking uses a seeded RNG; successful techniques are not independent random rolls. Both fighters share one position and one top relationship. Animations do not award points; the rules module validates settled outcomes.

`window.__combat` exposes a **read-only cloned** current match state for local inspection and browser tests. It does not offer a mutable state or test-only automatic victory command.

## Next milestones

1. Refine Phase 1 game feel with human playtesting, more nuanced defensive openings, and richer poses/contact feedback.
2. Expand BJJ only after the prototype remains stable: documented competition rules, gi/no-gi differences, more guards and submissions, and tournament brackets.
3. Add wrestling disciplines to the shared engine, then MMA striking and cage play.
4. Develop character creation, career progression, world simulation, and finances after the matches are sound.

See `docs/VALIDATION.md` for the actual checks performed and their limits.
