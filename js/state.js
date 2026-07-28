/* Central application state + a tiny event bus.
 *
 * `allPapers` always holds the full imported dataset (with any manual
 * edits applied: node deletions, author splits). `dataset` is the derived
 * view of the current disambiguation set (search result). */
const State = {
  allPapers: [],          // full paper list (edited)
  dataset: null,          // Pipeline.build() of the current team
  query: { author: "", startYear: null, endYear: null },

  selectedAuthors: [],    // multi-select in the network (order preserved)
  selectedJournal: null,
  strongLinks: [],        // ["a||b", ...]
  excludedAuthors: new Set(),  // unchecked in the association panel

  bus: new EventTarget(),

  emit(type, detail) {
    this.bus.dispatchEvent(new CustomEvent(type, { detail }));
  },
  on(type, handler) {
    this.bus.addEventListener(type, e => handler(e.detail));
  },

  linkKey(a, b) { return a < b ? `${a}||${b}` : `${b}||${a}`; },

  /* Build the disambiguation set: papers containing the searched author
   * within the year range form the seed; the team then expands along
   * co-authorship until a fixpoint (paper section 6.1 / fig. 2, where a
   * search surfaces the full collaboration teams around the name).
   * Empty author = whole dataset. */
  applyQuery() {
    const { author, startYear, endYear } = this.query;
    let papers = this.allPapers;
    if (startYear) papers = papers.filter(p => !p.year || p.year >= startYear);
    if (endYear) papers = papers.filter(p => !p.year || p.year <= endYear);
    if (author) {
      // seed with the exact name and any split variants ("Name 01", "Name 02"
      // …), so a search still works after disambiguation (paper fig. 9)
      const team = new Set();
      for (const p of papers) {
        for (const a of p.authors) {
          if (a === author || a.startsWith(author + " ")) team.add(a);
        }
      }
      if (team.size === 0) team.add(author);
      let size = 0;
      while (team.size !== size) {
        size = team.size;
        for (const p of papers) {
          if (p.authors.some(a => team.has(a))) p.authors.forEach(a => team.add(a));
        }
      }
      papers = papers.filter(p => p.authors.some(a => team.has(a)));
    }
    this.dataset = Pipeline.build(papers, this.strongLinks);
    this.selectedAuthors = [];
    this.selectedJournal = null;
    this.excludedAuthors = new Set();
    this.emit("dataset");
  },

  toggleAuthorSelection(name) {
    const i = this.selectedAuthors.indexOf(name);
    if (i >= 0) this.selectedAuthors.splice(i, 1);
    else this.selectedAuthors.push(name);
    this.emit("selection");
  },

  clearSelection() {
    if (this.selectedAuthors.length) {
      this.selectedAuthors = [];
      this.emit("selection");
    }
  },

  toggleStrongLink(a, b) {
    const key = this.linkKey(a, b);
    const i = this.strongLinks.indexOf(key);
    if (i >= 0) this.strongLinks.splice(i, 1);
    else this.strongLinks.push(key);
    if (CONFIG.enhancements.persistStrongLinks) {
      try { localStorage.setItem("vand-strong-links", JSON.stringify(this.strongLinks)); } catch (e) { /* ignore */ }
    }
    // confirmed collaborations feed back into the association-degree
    // scores (paper section 6.3 (3))
    if (this.dataset && CONFIG.strongLinkFeedback.enabled) {
      Pipeline.computeScores(this.dataset.authors, this.dataset.links,
        this.dataset.papers, this.strongLinks);
    }
    this.emit("stronglinks");
  },

  restoreStrongLinks() {
    if (!CONFIG.enhancements.persistStrongLinks) return;
    try {
      const saved = JSON.parse(localStorage.getItem("vand-strong-links") || "[]");
      if (Array.isArray(saved)) this.strongLinks = saved;
    } catch (e) { /* ignore */ }
  },

  toggleExcluded(name) {
    if (this.excludedAuthors.has(name)) this.excludedAuthors.delete(name);
    else this.excludedAuthors.add(name);
    this.emit("excluded");
  },

  /* --- manual data edits (paper section 6.3 (3): modifying relations) --- */

  /* Remove an author from the team: drop their solo papers, remove their
   * name from co-authored papers. */
  deleteAuthor(name) {
    this.allPapers = this.allPapers
      .filter(p => !(p.authors.length === 1 && p.authors[0] === name))
      .map(p => (p.authors.includes(name)
        ? { ...p, authors: p.authors.filter(a => a !== name) }
        : p));
    if (this.query.author === name) this.query.author = "";
    this.applyQuery();
  },

  /* Split an author into "Name 01", "Name 02", ... by the connected
   * components of the collaboration graph after removing the author
   * (paper case study 1: Wang Wei -> Wang Wei 01/02/03). Solo papers are
   * assigned by best keyword overlap with a component (fallback: 01). */
  splitAuthor(name) {
    const papers = this.dataset.papers;
    const adjacency = new Map();
    for (const l of this.dataset.links) {
      if (l.source === name || l.target === name) continue;
      if (!adjacency.has(l.source)) adjacency.set(l.source, []);
      if (!adjacency.has(l.target)) adjacency.set(l.target, []);
      adjacency.get(l.source).push(l.target);
      adjacency.get(l.target).push(l.source);
    }
    const component = new Map();
    let comp = 0;
    for (const other of this.dataset.authors.keys()) {
      if (other === name || component.has(other)) continue;
      comp++;
      const stack = [other];
      while (stack.length) {
        const cur = stack.pop();
        if (component.has(cur)) continue;
        component.set(cur, comp);
        for (const nb of adjacency.get(cur) || []) stack.push(nb);
      }
    }

    // which components does the split author actually collaborate with?
    const used = [...new Set(
      papers.filter(p => p.authors.includes(name))
        .flatMap(p => p.authors.filter(a => a !== name))
        .map(a => component.get(a))
        .filter(c => c !== undefined)
    )].sort((a, b) => a - b);
    if (used.length < 2) return null;

    const alias = new Map(used.map((c, i) => [c, `${name} ${String(i + 1).padStart(2, "0")}`]));

    const keywordProfiles = new Map(used.map(c => [c, new Map()]));
    for (const p of papers) {
      const comps = new Set(p.authors.map(a => component.get(a)).filter(c => alias.has(c)));
      for (const c of comps) {
        const profile = keywordProfiles.get(c);
        for (const kw of p.keywords) profile.set(kw, (profile.get(kw) || 0) + 1);
      }
    }

    const assign = paper => {
      const comps = [...new Set(paper.authors
        .filter(a => a !== name)
        .map(a => component.get(a))
        .filter(c => alias.has(c)))];
      if (comps.length === 1) return alias.get(comps[0]);
      if (comps.length > 1) return alias.get(comps.sort((a, b) => a - b)[0]);
      // solo paper: best keyword overlap
      let best = used[0], bestScore = -1;
      for (const c of used) {
        const profile = keywordProfiles.get(c);
        const score = paper.keywords.reduce((s, kw) => s + (profile.get(kw) || 0), 0);
        if (score > bestScore) { bestScore = score; best = c; }
      }
      return alias.get(best);
    };

    const ids = new Set(papers.filter(p => p.authors.includes(name)).map(p => p.id));
    this.allPapers = this.allPapers.map(p => {
      if (!ids.has(p.id) || !p.authors.includes(name)) return p;
      return { ...p, authors: p.authors.map(a => (a === name ? assign(p) : a)) };
    });
    this.applyQuery();
    return [...alias.values()];
  },
};
