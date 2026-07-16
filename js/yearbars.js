/* Small bar chart: publications per year for one author
 * (paper fig. 10: Ao Yu's publications concentrate before 2015). */
const YearBars = {
  render(container, author, dataset) {
    container.innerHTML = "";
    const years = d3.range(d3.min(dataset.years), d3.max(dataset.years) + 1);
    const data = years.map(y => ({ year: y, count: author.years.get(y) || 0 }));

    const width = 300, height = 110;
    const margin = { top: 8, right: 6, bottom: 22, left: 26 };

    const svg = d3.select(container).append("svg")
      .attr("width", width).attr("height", height);

    const x = d3.scaleBand().domain(years).range([margin.left, width - margin.right]).padding(0.25);
    const y = d3.scaleLinear()
      .domain([0, Math.max(1, d3.max(data, d => d.count))]).nice()
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
  },
};
