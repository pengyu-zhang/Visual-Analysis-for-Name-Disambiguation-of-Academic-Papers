/* Collaboration network module (paper section 6.3): force-directed graph
 * of the team; authors classified into the same research direction are
 * wrapped by a translucent hull. Interactions: click = select/highlight
 * (multi-select), click link = toggle strong link, double-click = direction
 * donut (enhancement), right-click = context menu, drag = reposition. */
const Network = {
  instances: [],

  init() {
    this.instances = [
      this.createInstance("#network-container"),
    ];
    State.on("dataset", () => this.renderAll());
    State.on("selection", () => this.updateHighlights());
    State.on("stronglinks", () => this.updateHighlights());
    State.on("excluded", () => this.renderAll());
    window.addEventListener("resize", () => this.renderAll());

    document.addEventListener("click", () => {
      document.getElementById("context-menu").hidden = true;
    });
  },

  createInstance(selector) {
    return { selector, svg: null, sim: null, nodes: [], links: [] };
  },

  visibleGraph() {
    const ds = State.dataset;
    const excluded = State.excludedAuthors;
    const authors = [...ds.authors.values()].filter(a => !excluded.has(a.name));
    const names = new Set(authors.map(a => a.name));
    const links = ds.links.filter(l => names.has(l.source) && names.has(l.target));
    return { authors, links };
  },

  renderAll() {
    for (const inst of this.instances) this.render(inst);
    this.renderLegend();
  },

  render(inst) {
    const container = document.querySelector(inst.selector);
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;
    container.innerHTML = "";
    const ds = State.dataset;
    if (!ds) return;

    const { authors, links } = this.visibleGraph();
    const width = container.clientWidth, height = container.clientHeight;

    // deterministic initial placement: direction groups around a circle
    const rng = mulberry32(CONFIG.seed);
    const dirIndex = new Map(ds.directions.map((d, i) => [d, i]));
    const nodes = authors.map(a => {
      const gi = dirIndex.get(a.direction) || 0;
      const angle = (gi / Math.max(ds.directions.length, 1)) * 2 * Math.PI;
      return {
        id: a.name,
        author: a,
        x: width / 2 + Math.cos(angle) * width / 5 + (rng() - 0.5) * 60,
        y: height / 2 + Math.sin(angle) * height / 5 + (rng() - 0.5) * 60,
      };
    });
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const simLinks = links.map(l => ({
      source: l.source, target: l.target, papers: l.papers,
    }));

    const svg = d3.select(container).append("svg")
      .attr("width", width).attr("height", height);
    const root = svg.append("g");

    const zoom = d3.zoom()
      .scaleExtent([0.3, 4])
      .filter(e => e.type !== "dblclick")
      .on("zoom", e => root.attr("transform", e.transform));
    svg.call(zoom);
    svg.on("click", () => State.clearSelection());

    const hullLayer = root.append("g");
    const linkLayer = root.append("g");
    const nodeLayer = root.append("g");
    const labelLayer = root.append("g");
    const donutLayer = root.append("g");

    // gentle pull of each research direction towards its own anchor, so
    // same-direction nodes cluster and the hulls stay compact (paper fig. 2)
    const anchors = new Map(ds.directions.map((d, i) => {
      const angle = (i / Math.max(ds.directions.length, 1)) * 2 * Math.PI - Math.PI / 2;
      return [d, {
        x: width / 2 + Math.cos(angle) * width * 0.28,
        y: height / 2 + Math.sin(angle) * height * 0.28,
      }];
    }));

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(simLinks).id(d => d.id).distance(CONFIG.network.linkDistance))
      .force("charge", d3.forceManyBody().strength(CONFIG.network.chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(CONFIG.network.collideRadius))
      .force("dirX", d3.forceX(d => anchors.get(d.author.direction)?.x ?? width / 2)
        .strength(CONFIG.network.groupStrength))
      .force("dirY", d3.forceY(d => anchors.get(d.author.direction)?.y ?? height / 2)
        .strength(CONFIG.network.groupStrength))
      .stop();
    for (let i = 0; i < CONFIG.network.warmupTicks; i++) sim.tick();

    // fit the warmed-up layout into the viewport
    if (nodes.length && width > 0 && height > 0) {
      const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
      const pad = 70;
      const bw = Math.max(...xs) - Math.min(...xs) + 2 * pad;
      const bh = Math.max(...ys) - Math.min(...ys) + 2 * pad;
      const scale = Math.max(0.3, Math.min(1.15, width / bw, height / bh));
      const tx = width / 2 - scale * (Math.min(...xs) + Math.max(...xs)) / 2;
      const ty = height / 2 - scale * (Math.min(...ys) + Math.max(...ys)) / 2;
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    const linkSel = linkLayer.selectAll("line").data(simLinks).join("line")
      .attr("class", "net-link")
      .on("click", (e, l) => {
        e.stopPropagation();
        State.toggleStrongLink(l.source.id, l.target.id);
      })
      .on("mouseover", (e, l) => Tooltip.show(e,
        `${l.source.id} — ${l.target.id}<br>${l.papers.length} ${t("papersCount")}`))
      .on("mouseout", () => Tooltip.hide());

    const radius = d => 10 + Math.sqrt(d.author.papers.length) * 2.4;

    const nodeSel = nodeLayer.selectAll("circle").data(nodes).join("circle")
      .attr("class", "net-node")
      .attr("r", radius)
      .attr("fill", d => d.author.color)
      .on("click", (e, d) => {
        e.stopPropagation();
        State.toggleAuthorSelection(d.id);
        Tabs.showAuthor(d.id);
      })
      .on("dblclick", (e, d) => {
        e.stopPropagation();
        if (CONFIG.enhancements.directionDonutOnDoubleClick) this.toggleDonut(donutLayer, d, radius(d));
      })
      .on("contextmenu", (e, d) => {
        e.preventDefault();
        e.stopPropagation();
        this.showContextMenu(e, d.id);
      })
      .on("mouseover", (e, d) => Tooltip.show(e,
        `<b>${d.id}</b><br>${t("direction")}: ${d.author.direction}<br>` +
        `${t("publications")}: ${d.author.papers.length}`))
      .on("mouseout", () => Tooltip.hide())
      .call(d3.drag()
        .on("start", (e, d) => { d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => {
          d.fx = e.x; d.fy = e.y;
          sim.alphaTarget(0.15).restart();
        })
        .on("end", (e, d) => {
          sim.alphaTarget(0);
          d.fx = null; d.fy = null;
        }));

    const labelSel = labelLayer.selectAll("text").data(nodes).join("text")
      .attr("class", "net-label")
      .attr("text-anchor", "middle")
      .text(d => d.id);

    const dirColor = d => ds.directionColors.get(d) || "#ddd";

    const ticked = () => {
      linkSel
        .attr("x1", l => l.source.x).attr("y1", l => l.source.y)
        .attr("x2", l => l.target.x).attr("y2", l => l.target.y);
      nodeSel.attr("cx", d => d.x).attr("cy", d => d.y);
      labelSel.attr("x", d => d.x).attr("y", d => d.y + radius(d) + 12);

      // direction hulls
      const groups = d3.group(nodes, d => d.author.direction);
      const hulls = [];
      for (const [dir, members] of groups) {
        if (!members.length) continue;
        hulls.push({ dir, path: this.hullPath(members, radius) });
      }
      hullLayer.selectAll("path").data(hulls, h => h.dir).join("path")
        .attr("class", "hull")
        .attr("d", h => h.path)
        .attr("fill", h => dirColor(h.dir))
        .attr("fill-opacity", 0.35)
        .attr("stroke", h => dirColor(h.dir))
        .attr("stroke-width", 24)
        .attr("stroke-opacity", 0.35);

      donutLayer.selectAll("g.donut").attr("transform", function () {
        const id = this.dataset.node;
        const n = nodeById.get(id);
        return n ? `translate(${n.x},${n.y})` : null;
      });
    };
    sim.on("tick", ticked);
    ticked();

    inst.svg = svg; inst.sim = sim; inst.nodes = nodes; inst.links = simLinks;
    this.updateHighlights();
  },

  /* Rounded padded hull around a set of nodes (single node -> circle). */
  hullPath(members, radius) {
    const pts = members.map(d => [d.x, d.y]);
    if (pts.length === 1) {
      const [x, y] = pts[0];
      const r = radius(members[0]) + 6;
      return `M${x - r},${y} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`;
    }
    if (pts.length === 2) pts.push([pts[0][0] + 0.1, pts[0][1] + 0.1]);
    const hull = d3.polygonHull(pts);
    return hull ? "M" + hull.join("L") + "Z" : "";
  },

  toggleDonut(layer, node, r) {
    const existing = layer.select(`g.donut[data-node="${CSS.escape(node.id)}"]`);
    if (!existing.empty()) { existing.remove(); return; }
    layer.selectAll("g.donut").remove();

    const ds = State.dataset;
    const entries = [...node.author.directions.entries()].sort((a, b) => b[1] - a[1]);
    const pie = d3.pie().value(d => d[1]).sort(null)(entries);
    const arc = d3.arc().innerRadius(r + 3).outerRadius(r + 16);
    const g = layer.append("g")
      .attr("class", "donut")
      .attr("data-node", node.id)
      .attr("transform", `translate(${node.x},${node.y})`)
      .style("pointer-events", "none");
    g.selectAll("path").data(pie).join("path")
      .attr("d", arc)
      .attr("fill", d => ds.directionColors.get(d.data[0]) || "#ccc")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);

    // compact legend list beside the node instead of radial labels
    // (labels around thin slices overlap)
    const lineH = 15, x0 = r + 24;
    const legend = g.append("g");
    legend.append("rect")
      .attr("x", x0 - 6)
      .attr("y", -entries.length * lineH / 2 - 5)
      .attr("width", 12 + 7 * Math.max(...entries.map(e => `${e[0]} (${e[1]})`.length)))
      .attr("height", entries.length * lineH + 10)
      .attr("rx", 4)
      .attr("fill", "rgba(255,255,255,0.92)")
      .attr("stroke", "#d8dde3");
    entries.forEach(([dir, count], i) => {
      const y = -entries.length * lineH / 2 + i * lineH + 7;
      legend.append("rect")
        .attr("x", x0).attr("y", y - 8)
        .attr("width", 9).attr("height", 9).attr("rx", 2)
        .attr("fill", ds.directionColors.get(dir) || "#ccc");
      legend.append("text")
        .attr("x", x0 + 14).attr("y", y)
        .attr("font-size", 10.5)
        .text(`${dir} (${count})`);
    });
  },

  showContextMenu(event, name) {
    const menu = document.getElementById("context-menu");
    menu.hidden = false;
    menu.style.left = Math.min(event.clientX, window.innerWidth - 210) + "px";
    menu.style.top = Math.min(event.clientY, window.innerHeight - 130) + "px";

    document.getElementById("ctx-split").onclick = () => {
      menu.hidden = true;
      const result = State.splitAuthor(name);
      alert(result ? t("splitDone") + result.join(", ") : t("splitNone"));
      Query.populate();
    };
    document.getElementById("ctx-delete").onclick = () => {
      menu.hidden = true;
      if (confirm(t("confirmDelete"))) {
        State.deleteAuthor(name);
        Query.populate();
      }
    };
    document.getElementById("ctx-analysis").onclick = () => {
      menu.hidden = true;
      State.selectedAuthors = [name];
      State.emit("selection");
      Analysis.enter(name);
    };
  },

  updateHighlights() {
    const selected = State.selectedAuthors;
    const strong = new Set(State.strongLinks);
    for (const inst of this.instances) {
      if (!inst.svg) continue;
      inst.svg.selectAll(".net-node")
        .classed("selected", d => selected.includes(d.id))
        .classed("dimmed", d => selected.length && !selected.includes(d.id));
      inst.svg.selectAll(".net-label")
        .classed("dimmed", d => selected.length && !selected.includes(d.id));
      const links = inst.svg.selectAll(".net-link")
        .classed("strong", l => strong.has(State.linkKey(l.source.id, l.target.id)))
        .classed("dimmed", l => selected.length &&
          !selected.includes(l.source.id) && !selected.includes(l.target.id));
      // paint strong / non-dimmed links above faded ones
      links.filter(function () { return !this.classList.contains("dimmed"); }).raise();
      links.filter(".strong").raise();
    }
  },

  renderLegend() {
    const ds = State.dataset;
    const el = document.getElementById("direction-legend");
    if (!ds) { el.innerHTML = ""; return; }
    el.innerHTML = ds.directions.map(d =>
      `<div class="legend-item"><span class="swatch" style="background:${ds.directionColors.get(d)}"></span>${d}</div>`
    ).join("");
  },
};

const Tooltip = {
  show(event, html) {
    const tip = document.getElementById("tooltip");
    tip.innerHTML = html;
    tip.hidden = false;
    tip.style.left = Math.min(event.clientX + 12, window.innerWidth - 330) + "px";
    tip.style.top = (event.clientY + 12) + "px";
  },
  hide() { document.getElementById("tooltip").hidden = true; },
};
