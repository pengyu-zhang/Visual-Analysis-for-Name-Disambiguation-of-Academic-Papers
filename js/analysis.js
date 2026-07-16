/* Analysis mode: a radial concept map centered on one author, expanding
 * into research directions and their keywords. Replaces the scraped
 * concept-map page of the original prototype. */
const Analysis = {
  init() {
    State.on("dataset", () => this.render());
    document.addEventListener("langchange", () => this.render());
    window.addEventListener("resize", () => {
      if (!document.getElementById("analysis-container").hidden) this.render();
    });
  },

  focusAuthor: null,

  enter(name) {
    this.focusAuthor = name;
    App.showCenterTab("analysis");
    this.render();
  },

  render() {
    const container = document.getElementById("analysis-container");
    if (container.hidden) return;
    container.innerHTML = "";
    const ds = State.dataset;
    if (!ds) return;

    const name = this.focusAuthor && ds.authors.has(this.focusAuthor)
      ? this.focusAuthor
      : [...ds.authors.keys()].sort()[0];
    const author = ds.authors.get(name);
    if (!author) return;

    // hierarchy: author -> directions -> top keywords of that direction
    const children = [...author.directions.keys()].sort().map(dir => {
      const kws = new Map();
      for (const p of author.papers) {
        if (Pipeline.paperDirection(p) !== dir) continue;
        for (const kw of p.keywords) kws.set(kw, (kws.get(kw) || 0) + 1);
      }
      return {
        name: dir,
        kind: "direction",
        children: [...kws.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([kw, count]) => ({ name: kw, kind: "keyword", count })),
      };
    });
    const rootData = { name, kind: "author", children };

    const width = container.clientWidth, height = container.clientHeight;
    const radius = Math.min(width, height) / 2 - 90;

    const tree = d3.tree()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
    const root = tree(d3.hierarchy(rootData));

    const svg = d3.select(container).append("svg")
      .attr("width", width).attr("height", height);
    const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);

    svg.call(d3.zoom().scaleExtent([0.4, 3]).on("zoom", e =>
      g.attr("transform", `translate(${width / 2},${height / 2}) scale(${e.transform.k})`)));

    g.append("g").selectAll("path").data(root.links()).join("path")
      .attr("fill", "none")
      .attr("stroke", "#b8c2cc")
      .attr("d", d3.linkRadial().angle(d => d.x).radius(d => d.y));

    const node = g.append("g").selectAll("g").data(root.descendants()).join("g")
      .attr("transform", d => `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`);

    node.append("circle")
      .attr("r", d => (d.data.kind === "author" ? 14 : d.data.kind === "direction" ? 8 : 4))
      .attr("fill", d => d.data.kind === "author"
        ? author.color
        : d.data.kind === "direction"
          ? ds.directionColors.get(d.data.name) || "#ccc"
          : "#8da4b8")
      .attr("stroke", "#697786");

    node.append("text")
      .attr("dy", "0.32em")
      .attr("x", d => (d.x < Math.PI === !d.children ? 10 : -10))
      .attr("text-anchor", d => (d.x < Math.PI === !d.children ? "start" : "end"))
      .attr("transform", d => (d.x >= Math.PI ? "rotate(180)" : null))
      .attr("font-size", d => (d.data.kind === "author" ? 14 : d.data.kind === "direction" ? 12 : 10.5))
      .attr("font-weight", d => (d.data.kind === "keyword" ? 400 : 600))
      .text(d => d.data.kind === "keyword" ? `${d.data.name} (${d.data.count})` : d.data.name);
  },
};
