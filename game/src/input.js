// Keyboard and mouse, read once per frame. WASD or arrows move; Shift sneaks, Space
// sprints, E grabs, Q pops smoke, mouse aims and click throws a spanner, H toggles the
// field-notes panel, M mutes, Esc pauses, R restarts a finished job. Actions are
// edge-triggered (a key press counts once, holding it does not repeat it), except
// movement, sneak, sprint and interact, which are held.

import { FIELD } from './config.js';

export const ACTION = {
  CONFIRM: 1 << 0,
  PAUSE: 1 << 1,
  RESTART: 1 << 2,
  THROW: 1 << 3,
  SMOKE: 1 << 4,
  NOTES: 1 << 5,
  MUTE: 1 << 6,
};

const KEY_ACTIONS = {
  Enter: ACTION.CONFIRM,
  ' ': ACTION.CONFIRM,
  Escape: ACTION.PAUSE,
  KeyR: ACTION.RESTART,
  KeyQ: ACTION.SMOKE,
  KeyH: ACTION.NOTES,
  KeyM: ACTION.MUTE,
};

/** Canvas coordinates of the mouse, in the 1280x720 logical field. */
function mouseInField(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
    y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
  };
}

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouse = { x: FIELD.width / 2, y: FIELD.height / 2 };
  let clickQueued = false;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    mouse = mouseInField(event, canvas);
  }
  function onMouseDown(event) {
    mouse = mouseInField(event, canvas);
    if (event.button === 0) clickQueued = true;
  }
  function onBlur() {
    keys.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** The held movement vector, normalised, from WASD or the arrow keys. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      const length = Math.hypot(x, y);
      return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
    },
    get sneak() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    get sprint() {
      return keys.has('Space');
    },
    get interact() {
      return keys.has('KeyE');
    },
    get aim() {
      return mouse;
    },
    /** Edge-triggered actions pressed since the last call; clears the queue. */
    takeActions() {
      let actions = 0;
      for (const code of pressed) {
        if (KEY_ACTIONS[code]) actions |= KEY_ACTIONS[code];
      }
      pressed.clear();
      if (clickQueued) {
        actions |= ACTION.THROW;
        clickQueued = false;
      }
      return actions;
    },
  };
}
