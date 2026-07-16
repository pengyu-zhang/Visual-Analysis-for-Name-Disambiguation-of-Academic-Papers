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
    const width = container.clientWidth - 8 || 400;
    const height = Math.max(rowCount * 26 + 60, 420);

    const sankey = d3.sankey()
      .nodeId(d => d.id)
      .nodeWidth(14)
      .nodePadding(8)
      .nodeSort((a, b) => d3.ascending(a.name, b.name))
      .extent([[130, 34], [width - 210, height - 8]]);

    const graph = sankey({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d })),
    });

    const svg = d3.select(container).append("svg")
      .attr("width", width).attr("height", height);

    svg.append("text").attr("class", "sankey-header")
      .attr("x", 126).attr("y", 20).attr("text-anchor", "end")
      .text(t("author"));
    svg.append("text").attr("class", "sankey-header")
      .attr("x", width - 200).attr("y", 20)
      .text(t("journal"));

    const authorColor = new Map(authors.map(a => [a.name, a.color]));

    svg.append("g").selectAll("path").data(graph.links).join("path")
      .attr("class", "sankey-link")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("fill", "none")
      .attr("stroke", d => authorColor.get(d.author) || "#999")
      .attr("stroke-width", d => Math.max(1.5, d.width))
      .attr("stroke-opacity", 0.55)
      .attr("data-author", d => d.author)
      .on("mouseover", (e, d) => Tooltip.show(e,
        `${d.author} → ${d.target.name}<br>${d.value} ${t("papersCount")}`))
      .on("mouseout", () => Tooltip.hide());

    const nodeSel = svg.append("g").selectAll("g").data(graph.nodes).join("g");
    nodeSel.append("rect")
      .attr("x", d => d.x0).attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => Math.max(1, d.y1 - d.y0))
      .attr("fill", d => d.kind === "author" ? d.color : "#c8cdd3")
      .attr("stroke", "#8894a0")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("click", (e, d) => this.clickNode(d));

    nodeSel.append("text")
      .attr("class", "sankey-node-label")
      .attr("x", d => d.kind === "author" ? d.x0 - 6 : d.x1 + 6)
      .attr("y", d => (d.y0 + d.y1) / 2 + 4)
      .attr("text-anchor", d => d.kind === "author" ? "end" : "start")
      .attr("fill", d => d.kind === "author" ? d.color : "#333")
      .attr("font-weight", d => d.kind === "author" ? 600 : 400)
      .text(d => d.name.length > 34 ? d.name.slice(0, 32) + "…" : d.name)
      .on("click", (e, d) => this.clickNode(d))
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

  /* When authors are selected, hide the flows of every other author
   * (paper fig. 3: clicking a node keeps only that author's journals). */
  updateHighlights() {
    const selected = State.selectedAuthors;
    d3.select("#sankey-container").selectAll(".sankey-link")
      .classed("dimmed", function () {
        return selected.length && !selected.includes(this.dataset.author);
      });
  },
};
