/* Association-degree module (paper section 6.2): a dumbbell chart.
 * Large circle (author color) = association score with the team;
 * small blue circle = publication score. Low association + high
 * publication count marks a suspicious node. */
const Dumbbell = {
  metric: "overall",

  init() {
    document.querySelectorAll(".metric-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".metric-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.metric = btn.dataset.metric;
        this.render();
      });
    });
    State.on("dataset", () => this.render());
    State.on("selection", () => this.highlight());
    document.addEventListener("langchange", () => this.render());
  },

  render() {
    const container = document.getElementById("dumbbell-container");
    container.innerHTML = "";
    const ds = State.dataset;
    if (!ds) return;

    const authors = [...ds.authors.values()]
      .sort((a, b) => a.scores[this.metric] - b.scores[this.metric]);

    const rowH = 26;
    const margin = { top: 26, right: 24, bottom: 8, left: 128 };
    const width = container.clientWidth - 12 || 300;
    const height = margin.top + margin.bottom + authors.length * rowH;

    const svg = d3.select(container).append("svg")
      .attr("width", width)
      .attr("height", height);

    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const y = name => margin.top + authors.findIndex(a => a.name === name) * rowH + rowH / 2;

    svg.append("g")
      .attr("transform", `translate(0,${margin.top - 6})`)
      .call(d3.axisTop(x).ticks(4).tickFormat(d3.format(".1f")))
      .call(g => g.selectAll("text").attr("font-size", 9));

    const row = svg.selectAll("g.db-row").data(authors).join("g").attr("class", "db-row");

    row.append("line")
      .attr("x1", a => x(Math.min(a.scores[this.metric], a.scores.pubs)))
      .attr("x2", a => x(Math.max(a.scores[this.metric], a.scores.pubs)))
      .attr("y1", a => y(a.name))
      .attr("y2", a => y(a.name))
      .attr("stroke", "#bbb");

    row.append("circle")   // small blue circle: publication score
      .attr("cx", a => x(a.scores.pubs))
      .attr("cy", a => y(a.name))
      .attr("r", 5)
      .attr("fill", "#3366cc")
      .append("title").text(a => `${a.name}: ${a.papers.length} ${t("papersCount")}`);

    row.append("circle")   // large circle: association score, author color
      .attr("class", "db-big")
      .attr("cx", a => x(a.scores[this.metric]))
      .attr("cy", a => y(a.name))
      .attr("r", 8)
      .attr("fill", a => a.color)
      .attr("stroke", "#555")
      .style("cursor", "pointer")
      .on("click", (e, a) => State.toggleAuthorSelection(a.name))
      .append("title").text(a =>
        `${a.name}\n${t("metricOverall")}: ${a.scores.overall.toFixed(2)}\n` +
        `${t("metricCoPub")}: ${a.scores.copub.toFixed(2)}\n` +
        `${t("metricDirection")}: ${a.scores.direction.toFixed(2)}`);

    row.append("text")
      .attr("class", a => "db-row-label" + (State.excludedAuthors.has(a.name) ? " excluded" : ""))
      .attr("x", margin.left - 8)
      .attr("y", a => y(a.name) + 4)
      .attr("text-anchor", "end")
      .attr("font-size", 11.5)
      .text(a => a.name)
      .on("click", (e, a) => {
        if (CONFIG.enhancements.dumbbellFiltersViews) State.toggleExcluded(a.name);
      })
      .append("title").text(a => a.name);

    this.highlight();
  },

  highlight() {
    d3.select("#dumbbell-container").selectAll(".db-big")
      .attr("stroke", a => State.selectedAuthors.includes(a.name) ? "#d0342c" : "#555")
      .attr("stroke-width", a => State.selectedAuthors.includes(a.name) ? 3 : 1);
  },
};
