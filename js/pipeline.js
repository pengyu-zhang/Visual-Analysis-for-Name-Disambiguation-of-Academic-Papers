/* Data pipeline: derives every view's data from a flat list of papers.
 *
 * Input rows (from CSV): { id, title, year, journal, authors, keywords, citations }
 *   - authors / keywords are semicolon-separated
 *   - an optional `direction` column may carry per-paper labels produced by
 *     an external classifier (e.g. the multi-view GCN of the paper, see the
 *     MVMA-GCN repository); without it a journal/keyword heuristic is used.
 *
 * Output (dataset): papers, authors, links, journals, flows and per-author
 * statistics used by the association-degree, network, journal and info views. */

/* Journal -> research direction map for the bundled demo data. Imported
 * CSVs may use their own `direction` column; unknown journals fall back
 * to "Other". */
const JOURNAL_DIRECTIONS = {
  "Fuel": "Energy & Thermal Engineering",
  "THERMAL SCIENCE": "Energy & Thermal Engineering",
  "Materials Science Forum": "Energy & Thermal Engineering",
  "International Corrosion Conference Series": "Energy & Thermal Engineering",
  "Journal of Natural Disasters": "Structural & Disaster Engineering",
  "MATEC Web of Conferences": "Structural & Disaster Engineering",
  "NONLINEAR DYNAMICS": "Structural & Disaster Engineering",
  "Composite Structures": "Structural & Disaster Engineering",
  "INTERNATIONAL JOURNAL OF FATIGUE": "Structural & Disaster Engineering",
  "Scientia Sinica": "Structural & Disaster Engineering",
  "ISPRS JOURNAL OF PHOTOGRAMMETRY AND REMOTE SENSING": "Remote Sensing & Photogrammetry",
  "Proceedings of Meetings on Acoustics": "Acoustics & Vibration",
  "International Congress on Sound and Vibration": "Acoustics & Vibration",
  "IEEE Sensors Journal": "Sensors & Space Science",
  "ASTROPHYSICS AND SPACE SCIENCE": "Sensors & Space Science",
  "APPLIED SURFACE SCIENCE": "Sensors & Space Science",
  "International Journal of Electrochemical Science": "Electrochemistry",
};

const Pipeline = {
  parsePapers(rows) {
    return rows
      .filter(r => r.title && r.authors)
      .map((r, i) => ({
        id: r.id || `P${String(i + 1).padStart(3, "0")}`,
        title: r.title,
        year: +r.year || 0,
        journal: r.journal || "",
        authors: r.authors.split(";").map(s => s.trim()).filter(Boolean),
        keywords: (r.keywords || "").split(";").map(s => s.trim()).filter(Boolean),
        citations: +r.citations || 0,
        direction: r.direction || "",
      }));
  },

  paperDirection(paper) {
    if (paper.direction) return paper.direction;
    return JOURNAL_DIRECTIONS[paper.journal] || "Other";
  },

  /* Deterministic pseudo impact factor for journals without real metadata:
   * a stable hash of the journal name mapped into [0.8, 8.0]. */
  impactFactor(journal) {
    let h = 2166136261;
    for (const ch of journal) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return Math.round((0.8 + ((h >>> 8) % 7200) / 1000) * 100) / 100;
  },

  build(papers, strongLinks = []) {
    const authors = new Map();
    const links = new Map();
    const journals = new Map();

    const linkKey = (a, b) => (a < b ? `${a}||${b}` : `${b}||${a}`);

    for (const paper of papers) {
      const direction = this.paperDirection(paper);

      if (paper.journal) {
        if (!journals.has(paper.journal)) {
          journals.set(paper.journal, {
            name: paper.journal,
            direction,
            impactFactor: this.impactFactor(paper.journal),
            papers: [],
          });
        }
        journals.get(paper.journal).papers.push(paper);
      }

      for (const name of paper.authors) {
        if (!authors.has(name)) {
          authors.set(name, {
            name,
            papers: [],
            journals: new Map(),
            keywords: new Map(),
            years: new Map(),
            directions: new Map(),
            citations: 0,
            coauthors: new Set(),
          });
        }
        const a = authors.get(name);
        a.papers.push(paper);
        a.citations += paper.citations;
        if (paper.journal) a.journals.set(paper.journal, (a.journals.get(paper.journal) || 0) + 1);
        for (const kw of paper.keywords) a.keywords.set(kw, (a.keywords.get(kw) || 0) + 1);
        if (paper.year) a.years.set(paper.year, (a.years.get(paper.year) || 0) + 1);
        a.directions.set(direction, (a.directions.get(direction) || 0) + 1);
      }

      for (let i = 0; i < paper.authors.length; i++) {
        for (let j = i + 1; j < paper.authors.length; j++) {
          const key = linkKey(paper.authors[i], paper.authors[j]);
          if (!links.has(key)) {
            links.set(key, { source: paper.authors[i], target: paper.authors[j], papers: [] });
          }
          links.get(key).papers.push(paper);
          authors.get(paper.authors[i]).coauthors.add(paper.authors[j]);
          authors.get(paper.authors[j]).coauthors.add(paper.authors[i]);
        }
      }
    }

    // dominant research direction per author (stand-in for the paper's
    // multi-view GCN classifier when no `direction` column is present)
    for (const a of authors.values()) {
      a.direction = [...a.directions.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0][0];
    }

    const names = [...authors.keys()].sort();
    const palette = Colors.distinct(names.length);
    names.forEach((name, i) => { authors.get(name).color = palette[i]; });

    const directions = [...new Set([...authors.values()].map(a => a.direction))].sort();
    const directionColors = new Map(directions.map((d, i) => [d, Colors.directions[i % Colors.directions.length]]));

    this.computeScores(authors, links, papers, strongLinks);

    return {
      papers,
      authors,
      links: [...links.values()],
      journals,
      directions,
      directionColors,
      years: papers.filter(p => p.year).map(p => p.year),
    };
  },

  /* Association-degree score (paper section 6.2): a weighted combination of
   * (1) co-publications with the team, (2) research-direction overlap with
   * the team and (3) connection centrality. Publication score is the
   * normalized publication count shown as the small blue circle. */
  computeScores(authors, links, papers, strongLinks = []) {
    const n = authors.size;
    const w = CONFIG.associationWeights;

    // aggregate team direction histogram
    const teamDirections = new Map();
    for (const a of authors.values()) {
      for (const [d, c] of a.directions) teamDirections.set(d, (teamDirections.get(d) || 0) + c);
    }
    const teamTotal = [...teamDirections.values()].reduce((s, v) => s + v, 0) || 1;

    const copubs = new Map(), maxima = { copub: 1, pubs: 1 };
    for (const a of authors.values()) copubs.set(a.name, 0);
    for (const l of links.values()) {
      copubs.set(l.source, copubs.get(l.source) + l.papers.length);
      copubs.set(l.target, copubs.get(l.target) + l.papers.length);
    }
    // user-confirmed collaborations feed back into the score
    // (paper section 6.3 (3))
    if (CONFIG.strongLinkFeedback.enabled) {
      for (const key of strongLinks) {
        const [a, b] = key.split("||");
        if (copubs.has(a) && copubs.has(b)) {
          copubs.set(a, copubs.get(a) + CONFIG.strongLinkFeedback.bonusPapers);
          copubs.set(b, copubs.get(b) + CONFIG.strongLinkFeedback.bonusPapers);
        }
      }
    }
    for (const a of authors.values()) {
      maxima.copub = Math.max(maxima.copub, copubs.get(a.name));
      maxima.pubs = Math.max(maxima.pubs, a.papers.length);
    }

    for (const a of authors.values()) {
      const coPub = copubs.get(a.name) / maxima.copub;
      // cosine similarity between the author's and the team's direction histograms
      let dot = 0, na = 0, nt = 0;
      for (const [d, c] of a.directions) {
        const tc = (teamDirections.get(d) || 0) / teamTotal;
        const ac = c / a.papers.length;
        dot += ac * tc; na += ac * ac;
      }
      for (const tv of teamDirections.values()) nt += (tv / teamTotal) ** 2;
      const direction = na && nt ? dot / Math.sqrt(na * nt) : 0;
      const centrality = n > 1 ? a.coauthors.size / (n - 1) : 0;

      a.scores = {
        copub: coPub,
        direction,
        centrality,
        overall: w.coPub * coPub + w.direction * direction + w.centrality * centrality,
        pubs: a.papers.length / maxima.pubs,
      };
    }
  },

  /* Program-generated disambiguation candidates (paper section 2, S1):
   * names whose co-authors fall apart into two or more disconnected
   * groups once the name itself is removed from the collaboration graph —
   * the structural signature of the "Wang Wei" / "Li Jie" case studies. */
  disambiguationCandidates(papers) {
    const adj = new Map();
    const touch = n => { if (!adj.has(n)) adj.set(n, new Set()); return adj.get(n); };
    for (const p of papers) {
      for (let i = 0; i < p.authors.length; i++) {
        touch(p.authors[i]);
        for (let j = i + 1; j < p.authors.length; j++) {
          touch(p.authors[i]).add(p.authors[j]);
          touch(p.authors[j]).add(p.authors[i]);
        }
      }
    }
    const candidates = [];
    for (const [name, neighbours] of adj) {
      if (neighbours.size < 2) continue;
      const seen = new Set([name]);
      let components = 0;
      for (const start of neighbours) {
        if (seen.has(start)) continue;
        components++;
        const stack = [start];
        while (stack.length) {
          const cur = stack.pop();
          if (seen.has(cur)) continue;
          seen.add(cur);
          for (const nb of adj.get(cur)) if (!seen.has(nb)) stack.push(nb);
        }
      }
      if (components >= 2) candidates.push(name);
    }
    return candidates.sort();
  },

  /* Bibliometric radar metrics, normalized to [0, 5]. */
  radarMetrics(author, dataset) {
    const cites = author.papers.map(p => p.citations).sort((a, b) => b - a);
    let h = 0;
    while (h < cites.length && cites[h] >= h + 1) h++;
    let g = 0, sum = 0;
    for (let i = 0; i < cites.length; i++) {
      sum += cites[i];
      if (sum >= (i + 1) ** 2) g = i + 1;
    }
    const years = [...author.years.keys()];
    const maxYear = Math.max(...dataset.years, 0);
    const recent = author.papers.filter(p => p.year >= maxYear - 4).length;

    const maxPubs = Math.max(...[...dataset.authors.values()].map(a => a.papers.length), 1);
    const maxCites = Math.max(...[...dataset.authors.values()].map(a => a.citations), 1);
    const maxCo = Math.max(...[...dataset.authors.values()].map(a => a.coauthors.size), 1);

    const clamp5 = v => Math.round(Math.min(5, Math.max(0, v)) * 100) / 100;
    return [
      { axis: "radarPapers", value: clamp5(5 * author.papers.length / maxPubs) },
      { axis: "radarCitations", value: clamp5(5 * author.citations / maxCites) },
      { axis: "radarHIndex", value: clamp5(h) },
      { axis: "radarGIndex", value: clamp5(g / 2) },
      { axis: "radarSociability", value: clamp5(5 * author.coauthors.size / maxCo) },
      { axis: "radarDiversity", value: clamp5(author.journals.size) },
      { axis: "radarActivity", value: clamp5(author.papers.length ? 5 * recent / author.papers.length : 0) },
    ];
  },
};
