// Procedural sound: every cue is a small WebAudio oscillator phrase, so the game
// needs no sound files at all. The context is created on the first user gesture
// (browsers refuse sound before one); M toggles mute.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (!context) {
      try {
        context = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        context = null;
      }
    }
    if (context && context.state === 'suspended') context.resume();
    return context;
  }

  /** One short tone: frequency slides from `from` to `to` over `seconds`. */
  function tone(from, to, seconds, type, gainValue, when = 0) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const start = ctx.currentTime + when;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(gainValue, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  return {
    /** Call on the first click or keypress so later cues have a context. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    click() {
      tone(660, 520, 0.07, 'sine', 0.08);
    },
    pickup() {
      tone(880, 880, 0.08, 'sine', 0.1);
      tone(1318, 1318, 0.12, 'sine', 0.1, 0.07);
    },
    prize() {
      tone(523, 523, 0.12, 'triangle', 0.12);
      tone(659, 659, 0.12, 'triangle', 0.12, 0.1);
      tone(784, 784, 0.2, 'triangle', 0.12, 0.2);
    },
    clang() {
      tone(2200, 300, 0.25, 'square', 0.06);
      tone(1470, 220, 0.3, 'square', 0.05, 0.03);
    },
    smoke() {
      tone(300, 90, 0.4, 'sawtooth', 0.05);
    },
    spotted() {
      tone(220, 440, 0.3, 'sawtooth', 0.12);
      tone(220, 440, 0.3, 'sawtooth', 0.12, 0.25);
    },
    tripwire() {
      tone(1800, 1800, 0.09, 'square', 0.09);
      tone(1800, 1800, 0.09, 'square', 0.09, 0.12);
    },
    win() {
      tone(523, 523, 0.15, 'triangle', 0.12);
      tone(659, 659, 0.15, 'triangle', 0.12, 0.12);
      tone(784, 784, 0.15, 'triangle', 0.12, 0.24);
      tone(1046, 1046, 0.35, 'triangle', 0.12, 0.36);
    },
    lose() {
      tone(392, 196, 0.5, 'sawtooth', 0.1);
      tone(311, 155, 0.6, 'sawtooth', 0.1, 0.3);
    },
  };
}
