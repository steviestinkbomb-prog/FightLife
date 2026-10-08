# Phase 1 development validation

This session created a modular TypeScript/Vite project in the previously empty FightLife checkout. The prepared workflow is local browser BJJ quick matches and situational training, not the later wrestling, MMA, or career phases.

## Current validation

- `npm ci --cache /workspace/.cache/npm --no-audit --no-fund`: frozen-lockfile installation.
- `npm run build`: strict TypeScript check and Vite production bundle.
- `npm test`: 50 tests across combat and fixed-timestep loop suites.
- `npm run test:browser`: 7 Chromium end-to-end tests passed on the final source; no tests skipped.
- Vite startup and a functional local HTTP request to the game's HTML/module.
- Desktop and 390px-width visual inspection, including a ground-position screenshot.

The browser gameplay tests execute a standing keyboard takedown, settle into guard, advance side control to mount, initiate and actively finish a submission, observe an autonomous CPU win in an actual quick match, inspect its stored timeline, and restart the match. Other checks cover movement, pause/resume, rebinding persistence/conflicts, responsive overflow, distinguishable mirror fighters, corrupt history, and storage failures. Practice results are correctly excluded from the quick-match record.

Combat tests verify both successful and failed shots, early counters and late scramble defense, geometry/facing eligibility, all required graph nodes, connected ground constraints, top/bottom legality, guard pulls, sweeps, passes, advances, escapes, buffered follow-ups, simultaneous actions and interruption, stamina, submission completion and defense, legal stabilization, canceled/duplicate points, timer endings, draws, taps, match resets, deterministic seeded behavior, all five active CPU styles, passive partners, and finite five-minute matches.

The loop tests compare identical simulation inputs at regular 60 FPS with irregular render frames including a 470 ms visible hitch. The complete simulation states agree. Pausing excludes paused time from catch-up. This catches simulation slowdowns caused by discarding frame elapsed time.

## Measured sample

A 120-frame headless Chromium training sample measured an average `requestAnimationFrame` interval of **16.48 ms**, with a maximum of **16.80 ms**. This is a small current-machine sample, not a guarantee of rendering performance on other hardware. The HUD also measures simulation workload independently. Five-minute simulated matches were tested for finite resources and bounded event history; a long real-time memory/leak soak and hardware/gamepad testing have not been performed.

## Corrections made during validation

- Connected movement now translates a common anchor rather than allowing independent relative drift.
- Ground poses interpolate joints and facing during transitions; camera zoom uses uniform scale.
- Mouse coordinates use the camera's inverse projection so targeting matches the view.
- Passive practice partners remain passive during submission contests.
- Frame elapsed time is fully processed through fixed ticks instead of being clipped during visible hitches.
- Stored records are validated before display; storage failure messaging remains accurate after opening and closing a timeline.
- Mirror fighters use distinct corner uniforms; rematches reset pause labeling and gameplay state.

## Limits

No known failing checks remain after the final run. Playtest balance, tactical depth, and anatomical animation fidelity remain prototype-level. Windows-specific behavior, real gamepad hardware, controller vibration, audio, full official event rules, advantages/penalties, gi competition, and later career/wrestling/MMA systems are not claimed as tested or implemented.

The official IBJJF documentation request returned HTTP 403 in this environment. The rules are explicitly labeled a limited adult no-gi practice ruleset. Complete official competition logic requires authoritative rule research before implementation.

Source files were created in the existing isolated checkout. No Git push or remote publication was performed.
