# EMBERLINE — The Midnight Freight Heist

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/fauzinfau4/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/fauzinfau4/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down stealth heist in a night freight yard. You are Wren, a thief with three
jobs in one night: lift the Brass Seal from the signal office, take the Conductor's
Ledger from the sorting hall, and steal the Starlight Manifest from the vault car —
then reach the getaway before dawn.

## How to play

- **WASD / arrows** — move
- **Shift** — sneak (slow, quiet, hard to spot)
- **Space** — sprint (fast, loud: guards hear it)
- **Mouse aim + click** — throw a spanner. The clang pulls guards to where it lands.
  You carry 3 per job; a thrown spanner is a spanner spent.
- **Q** — pop a smoke puff. Nobody can see you inside it. You carry 2 per job.
- **E (hold)** — grab loot beside you. Crates are quick; the prize takes longer and
  opens the getaway gate.
- **H** — field notes · **M** — mute · **Esc** — pause · **R** — restart the job

## The rules of the yard

- **Vision cones** are real: guards and cameras see what their cone touches, and
  walls and boxcars cut the cone short. Read the cone before you move.
- **Lamplight betrays you.** In a lamp's pool a guard spots you in under half a
  second; in shadow, sneaking, it takes more than two. The ring around Wren is
  amber when lit, teal when hidden.
- **Suspicion is a meter, not a switch.** A glimpse makes a guard curious — it
  turns, walks over, and looks. Break line of sight and curiosity fades. Only a
  full meter makes it hunt you, and only a touch (or a full alarm) catches you.
- **The alarm** climbs while anyone hunts you or a camera holds you, and cools
  when you break away. At 100 the yard locks down.
- **Tripwires pulse** — on for 3 seconds, off for 1.5. Cross in the dark gap.
- **Score** is loot plus a time bonus, with a +$300 ghost bonus for a job nobody
  ever spotted you on.

## The three jobs

1. **The Siding Yard** — the Brass Seal, 2 guards, 1 camera.
2. **The Sorting Hall** — the Conductor's Ledger, 3 guards, 2 cameras, tripwires.
3. **The Vault Car** — the Starlight Manifest, 3 guards, 2 cameras, live wires.

## Play it

Serve `game/` with any static server (`node serve.ts`, then
http://localhost:8080) and open it in desktop Chrome. No network request is made:
every script is a file under `game/` and every sound is synthesized in the browser.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game's own code,
staged by `game/src/shots.js` through `?shot=cover|suspicion|vault|hunt&seed=7`
(see `shots.json`). The cover's callout labels are drawn by the renderer as part
of the frame.

## Structure

- `game/src/config.js` — all tuning numbers and the palette
- `game/src/random.js` — the seeded random generator
- `game/src/geometry.js` — segment tests, raycasts, vision polygons, line of sight
- `game/src/levels.js` — the three hand-built jobs
- `game/src/guards.js` — guard patrol, suspicion, investigation and hunt
- `game/src/cameras.js` — sweeping pole cameras
- `game/src/player.js` — movement, spanners, smoke, noise
- `game/src/world.js` — the alarm, loot, tripwires, win and caught moments
- `game/src/audio.js` — procedural WebAudio sound cues
- `game/src/render.js` — everything drawn on the canvas, HUD included
- `game/src/shots.js` — the staged screenshot scenes
- `game/src/input.js` — keyboard and mouse
- `game/src/main.js` — boot, the fixed-step loop, the four screens

Original game, art, names and sounds — nothing copied from any commercial game.
