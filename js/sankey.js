/* Publication-journal module (paper section 6.3 (1)): a Sankey diagram
 * with authors on the left and journals on the right. Flows carry the
 * author's unique color; a journal's incoming edge mix therefore shows
 * which authors publish there. Clicking an author node filters the view
 * to that author (linked with the network); clicking a journal opens the
 * journal-info tab. */
const SankeyView = {
  init() {
    State.on("dataset", () => this.render());
    State.on("selection", () => this.updateHighlights());
    State.on("excluded", () => this.render());
    document.addEventListener("langchange", () => this.render());
    window.addEventListener("resize", () => this.render());
  },

  render() {
    const container = document.getElementById("sankey-container");
    container.innerHTML = "";
    const ds = State.dataset;
    if (!ds) return;

    const excluded = State.excludedAuthors;
    const authors = [...ds.authors.values()].filter(a => !excluded.has(a.name));

    const flows = [];
    for (const a of authors) {
      for (const [journal, count] of a.journals) {
        flows.push({ author: a.name, journal, count });
      }
    }
    if (!flows.length) return;

    const journalNames = [...new Set(flows.map(f => f.journal))].sort();
    const nodes = [
      ...authors.map(a => ({ id: "a:" + a.name, kind: "author", name: a.name, color: a.color })),
      ...journalNames.map(j => ({ id: "j:" + j, kind: "journal", name: j })),
    ];
    const links = flows.map(f => ({
      source: "a:" + f.author, target: "j:" + f.journal, value: f.count, author: f.author,
    }));

    const rowCount = Math.max(authors.length, journalNames.length);
    const width = container.clientWidth - 8 || 460;
    const height = Math.max(rowCount * 26 + 60, 420);

    // give most of the horizontal space to the ribbons: author labels get
    // ~110px on the left, journal labels ~150px on the right
    const sankey = d3.sankey()
      .nodeId(d => d.id)
      .nodeWidth(16)
      .nodePadding(8)
      .nodeSort((a, b) => d3.ascending(a.name, b.name))
      .extent([[112, 34], [width - 168, height - 8]]);

    const graph = sankey({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d })),
    });

    const svg = d3.select(container).append("svg")
      .attr("width", width).attr("height", height);

    svg.append("text").attr("class", "sankey-header")
      .attr("x", 108).attr("y", 20).attr("text-anchor", "end")
      .text(t("author"));
    svg.append("text").attr("class", "sankey-header")
      .attr("x", width - 162).attr("y", 20)
      .text(t("journal"));

    const authorColor = new Map(authors.map(a => [a.name, a.color]));
    const hover = name => this.updateHighlights(name);

    svg.append("g").selectAll("path").data(graph.links).join("path")
      .attr("class", "sankey-link")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("fill", "none")
      .attr("stroke", d => authorColor.get(d.author) || "#999")
      .attr("stroke-width", d => Math.max(2, d.width))
      .attr("stroke-opacity", 0.5)
      .attr("data-author", d => d.author)
      .on("mouseover", (e, d) => {
        hover(d.author);
        Tooltip.show(e, `${d.author} → ${d.target.name}<br>${d.value} ${t("papersCount")}`);
      })
      .on("mouseout", () => { hover(null); Tooltip.hide(); });

    const nodeSel = svg.append("g").selectAll("g").data(graph.nodes).join("g");

    // author bars: the author's unique color
    nodeSel.filter(d => d.kind === "author").append("rect")
      .attr("x", d => d.x0).attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => Math.max(1, d.y1 - d.y0))
      .attr("fill", d => d.color)
      .attr("stroke", "#8894a0")
      .attr("stroke-width", 0.5);

    // journal bars: stacked segments, one per contributing author, sized by
    // that author's share (paper section 6.3: a journal's color is decided
    // by the authors who publish in it, proportionally)
    const self = this;
    nodeSel.filter(d => d.kind === "journal").each(function (d) {
      const g = d3.select(this);
      for (const l of d.targetLinks) {
        g.append("rect")
          .attr("x", d.x0)
          .attr("y", l.y1 - l.width / 2)
          .attr("width", d.x1 - d.x0)
          .attr("height", Math.max(1, l.width))
          .attr("fill", authorColor.get(l.author) || "#c8cdd3");
      }
      g.append("rect")   // outline + click/hover target
        .attr("x", d.x0).attr("y", d.y0)
        .attr("width", d.x1 - d.x0)
        .attr("height", Math.max(1, d.y1 - d.y0))
        .attr("fill", "transparent")
        .attr("stroke", "#8894a0")
        .attr("stroke-width", 0.5)
        .style("cursor", "pointer")
        .on("click", () => self.clickNode(d));
    });
    nodeSel.filter(d => d.kind === "author").select("rect")
      .style("cursor", "pointer")
      .on("click", (e, d) => this.clickNode(d))
      .on("mouseover", (e, d) => hover(d.name))
      .on("mouseout", () => hover(null));

    nodeSel.append("text")
      .attr("class", "sankey-node-label")
      .attr("x", d => d.kind === "author" ? d.x0 - 6 : d.x1 + 6)
      .attr("y", d => (d.y0 + d.y1) / 2 + 4)
      .attr("text-anchor", d => d.kind === "author" ? "end" : "start")
      .attr("fill", d => d.kind === "author" ? d.color : "#333")
      .attr("font-weight", d => d.kind === "author" ? 600 : 400)
      .text(d => d.name.length > 26 ? d.name.slice(0, 24) + "…" : d.name)
      .on("click", (e, d) => this.clickNode(d))
      .on("mouseover", (e, d) => { if (d.kind === "author") hover(d.name); })
      .on("mouseout", () => hover(null))
      .append("title").text(d => d.name);

    this.updateHighlights();
  },

  clickNode(d) {
    if (d.kind === "author") {
      State.toggleAuthorSelection(d.name);
      Tabs.showAuthor(d.name);
    } else {
      State.selectedJournal = d.name;
      Tabs.showJournal(d.name);
    }
  },

  /* When authors are selected (or hovered), fade the flows of every other
   * author to a pale blue, as in the original prototype (paper fig. 3:
   * clicking a node keeps only that author's journals). */
  updateHighlights(hovered = null) {
    const selected = State.selectedAuthors;
    d3.select("#sankey-container").selectAll(".sankey-link")
      .classed("dimmed", function () {
        const author = this.dataset.author;
        if (hovered) return author !== hovered;
        return selected.length && !selected.includes(author);
      });
  },
};
