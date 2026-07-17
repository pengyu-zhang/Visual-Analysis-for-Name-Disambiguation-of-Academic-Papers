/* Global configuration. Everything that goes beyond the paper is an
 * explicit switch under `enhancements`; the defaults reproduce the
 * behaviour described in the paper (see docs/REFACTORING_NOTES.md). */
const CONFIG = {
  language: "en",              // "en" | "zh"
  dataUrl: "data/demo_papers.csv",

  // Association-degree score = weighted sum of three components
  // (paper section 6.2: co-publication count, research-direction overlap,
  // and connection centrality). Weights are adjustable.
  associationWeights: { coPub: 0.4, direction: 0.35, centrality: 0.25 },

  // Strong links mark a collaboration as confirmed by the user; the paper
  // (section 6.3 (3)) feeds them back into the algorithm. Here they count
  // as extra co-publications in the association-degree score.
  strongLinkFeedback: { enabled: true, bonusPapers: 2 },

  network: {
    linkDistance: 95,
    chargeStrength: -260,
    collideRadius: 26,
    groupStrength: 0.14,       // pull towards the direction anchor (hull compactness)
    warmupTicks: 200,          // synchronous ticks before first paint (stable layout)
  },

  wordcloud: { maxWords: 24 },

  // Deterministic seed used for colors, word-cloud layout and initial
  // node placement, so every page load renders the same picture.
  seed: 42,

  enhancements: {
    // Beyond the paper: the original prototype showed a per-node pie
    // drill-down (ZoomCharts). Reimplemented as a direction donut shown
    // around a node on double-click.
    directionDonutOnDoubleClick: true,
    // Beyond the paper: strong links survive a page reload (localStorage).
    persistStrongLinks: true,
    // Beyond the paper: unchecking an author in the association panel
    // hides it in the network and journal views.
    dumbbellFiltersViews: true,
  },
};
