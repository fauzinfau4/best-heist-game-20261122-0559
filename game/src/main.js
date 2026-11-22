// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title (pick one of three jobs), play,
// paused and job over.
//
// ?seed=N fixes the yard's random draws. ?shot=cover|suspicion|vault|hunt (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { JOBS } from './levels.js';
import { createRandom } from './random.js';
import { createWorld, EVENT, stepWorld } from './world.js';
import { ACTION, createInput } from './input.js';
import { createRenderer, SCREEN } from './render.js';
import { stageShot, shotJob } from './shots.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const world = createWorld(shotJob(name), createRandom(seed));
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, {
      annotations: scene.annotations,
      showNotes: scene.notes,
      time: world.elapsed,
      best: readBest(),
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN.TITLE;
  let selectedJob = 0;
  let best = readBest();
  let showNotes = true;
  let world = createWorld(selectedJob, createRandom(seed));
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startJob(jobIndex) {
    world = createWorld(jobIndex, createRandom(seed));
    accumulator = 0;
    screen = SCREEN.PLAY;
    announce(`Job ${jobIndex + 1}: ${JOBS[jobIndex].name}. ${JOBS[jobIndex].brief}`);
  }

  function endJob() {
    screen = SCREEN.OVER;
    if (world.won && world.score > best) {
      best = world.score;
      saveBest(best);
    }
    announce(world.won ? `Clean getaway. Take $${world.score}.` : 'Caught. Try the job again.');
  }

  function handleActions(actions) {
    if (actions & ACTION.MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION.NOTES) showNotes = !showNotes;
    if (screen === SCREEN.TITLE) {
      if (actions & ACTION.CONFIRM) {
        audio.unlock();
        audio.click();
        startJob(selectedJob);
      }
      return;
    }
    if (screen === SCREEN.OVER) {
      if (actions & (ACTION.CONFIRM | ACTION.RESTART)) {
        audio.unlock();
        if (world.won && world.jobIndex < JOBS.length - 1 && actions & ACTION.CONFIRM) {
          startJob(world.jobIndex + 1);
        } else {
          startJob(world.jobIndex);
        }
      }
      return;
    }
    if (actions & ACTION.PAUSE) {
      if (screen === SCREEN.PLAY) {
        screen = SCREEN.PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN.PAUSED) {
        screen = SCREEN.PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN.PAUSED && actions & ACTION.RESTART) startJob(world.jobIndex);
  }

  function handleJobKeys(event) {
    if (screen !== SCREEN.TITLE) return;
    if (event.code === 'Digit1') selectedJob = 0;
    if (event.code === 'Digit2') selectedJob = 1;
    if (event.code === 'Digit3') selectedJob = 2;
  }
  window.addEventListener('keydown', handleJobKeys);

  function step(actions) {
    if (screen !== SCREEN.PLAY) return;
    const move = input.moveVector();
    world.player.aimX = input.aim.x;
    world.player.aimY = input.aim.y;
    const events = stepWorld(
      world,
      STEP,
      { move, sneak: input.sneak, sprint: input.sprint },
      {
        throw: Boolean(actions & ACTION.THROW),
        smoke: Boolean(actions & ACTION.SMOKE),
        interact: input.interact,
      },
    );
    if (events & EVENT.LOOT) audio.pickup();
    if (events & EVENT.PRIZE) audio.prize();
    if (events & EVENT.SPOTTED) audio.spotted();
    if (events & EVENT.TRIPWIRE) audio.tripwire();
    if (events & EVENT.NOISE) audio.clang();
    if (events & (EVENT.CAUGHT | EVENT.ESCAPED)) {
      if (events & EVENT.ESCAPED) audio.win();
      else audio.lose();
      endJob();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Actions are read once per frame and spent on the first fixed step; later
    // catch-up steps in the same frame get none, so a press never fires twice.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN.PLAY) {
      let first = true;
      while (accumulator >= STEP && screen === SCREEN.PLAY) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, {
      selectedJob,
      best,
      showNotes,
      time: world.elapsed,
    });
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN.PLAY) {
      screen = SCREEN.PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberline. Press 1 to 3 to choose a job, Enter to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
