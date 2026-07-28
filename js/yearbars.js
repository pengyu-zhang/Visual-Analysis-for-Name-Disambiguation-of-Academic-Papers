/* Small bar chart: publications per year for one author, with the team
 * average as a dashed reference line (paper fig. 10 / guideline G6:
 * Ao Yu's publications concentrate before 2015, unlike the team's
 * year-on-year growth). */
const YearBars = {
  render(container, author, dataset) {
    container.innerHTML = "";
    const years = d3.range(d3.min(dataset.years), d3.max(dataset.years) + 1);
    const data = years.map(y => ({ year: y, count: author.years.get(y) || 0 }));

    // team average publications per author per year
    const teamPerYear = new Map();
    for (const a of dataset.authors.values()) {
      for (const [yr, c] of a.years) teamPerYear.set(yr, (teamPerYear.get(yr) || 0) + c);
    }
    const teamSize = Math.max(1, dataset.authors.size);
    const avg = years.map(yr => ({ year: yr, value: (teamPerYear.get(yr) || 0) / teamSize }));

    const width = 300, height = 110;
    const margin = { top: 14, right: 6, bottom: 22, left: 26 };

    const svg = d3.select(container).append("svg")
      .attr("width", width).attr("height", height);

    const x = d3.scaleBand().domain(years).range([margin.left, width - margin.right]).padding(0.25);
    const y = d3.scaleLinear()
      .domain([0, Math.max(1, d3.max(data, d => d.count), d3.max(avg, d => d.value))]).nice()
      .range([height - margin.bottom, margin.top]);

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickValues(years.filter((y2, i) => i % 2 === 0)).tickFormat(d3.format("d")))
      .call(g => g.selectAll("text").attr("font-size", 8.5));
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(3).tickFormat(d3.format("d")))
      .call(g => g.selectAll("text").attr("font-size", 8.5));

    svg.selectAll("rect").data(data).join("rect")
      .attr("x", d => x(d.year))
      .attr("y", d => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", d => y(0) - y(d.count))
      .attr("fill", author.color)
      .attr("fill-opacity", 0.8)
      .append("title").text(d => `${d.year}: ${d.count}`);

    // dashed team-average reference line (G6)
    svg.append("path")
      .attr("class", "team-avg")
      .attr("d", d3.line()
        .x(d => x(d.year) + x.bandwidth() / 2)
        .y(d => y(d.value))(avg))
      .attr("fill", "none")
      .attr("stroke", "#5b6672")
      .attr("stroke-width", 1.4)
      .attr("stroke-dasharray", "4 3")
      .append("title").text(t("teamAverage"));

    svg.append("line")
      .attr("x1", width - 78).attr("x2", width - 62)
      .attr("y1", 8).attr("y2", 8)
      .attr("stroke", "#5b6672").attr("stroke-dasharray", "4 3");
    svg.append("text")
      .attr("x", width - 58).attr("y", 11)
      .attr("font-size", 8.5).attr("fill", "#5b6672")
      .text(t("teamAverage"));
  },
};
