// A tiny seeded random generator (mulberry32) plus the helpers the world uses to shuffle
// patrol orders and scatter gravel, so a fixed seed always builds the same yard.

/** mulberry32: a small, fast seeded PRNG with a full 32-bit period for our purposes. */
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + (max - min) * next();
    },
    /** An integer in [min, max). */
    int(min, max) {
      return Math.floor(min + (max - min) * next());
    },
    /** Pick one element of an array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}
