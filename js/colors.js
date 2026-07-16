/* Deterministic color assignment.
 *
 * The paper (section 6.3) assigns every author a unique color by sampling
 * RGB values and greedily keeping candidates whose Euclidean distance to
 * all previously chosen colors is maximal. Reimplemented here with a
 * seeded PRNG so the palette is identical on every load. */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Colors = {
  /* n visually distinct, deterministic author colors. */
  distinct(n, seed = CONFIG.seed) {
    const rng = mulberry32(seed);
    const chosen = [];
    const dist2 = (a, b) =>
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    while (chosen.length < n) {
      let best = null, bestScore = -1;
      for (let c = 0; c < 60; c++) {
        // avoid near-white and near-black candidates so labels stay readable
        const cand = [
          40 + Math.floor(rng() * 190),
          40 + Math.floor(rng() * 190),
          40 + Math.floor(rng() * 190),
        ];
        const score = chosen.length
          ? Math.min(...chosen.map(p => dist2(p, cand)))
          : dist2(cand, [255, 255, 255]);
        if (score > bestScore) { bestScore = score; best = cand; }
      }
      chosen.push(best);
    }
    return chosen.map(c => `rgb(${c[0]},${c[1]},${c[2]})`);
  },

  /* Soft pastel palette for research-direction hulls (paper fig. 2 uses
   * light translucent blobs behind the nodes). */
  directions: [
    "#f5e6a3", "#f4c2c2", "#b5d99c", "#a8d8ea", "#d7bde2",
    "#f8c471", "#aed6f1", "#f5b7b1", "#a3e4d7", "#d5dbdb",
  ],
};
