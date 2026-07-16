/* Radar chart of bibliometric indicators for one author
 * (author-info tab; axes as in the original prototype: papers, citations,
 * h-index, g-index, sociability, diversity, activity). */
const Radar = {
  render(container, metrics, color) {
    container.innerHTML = "";
    const size = 188, levels = 5, maxValue = 5;
    const radius = size / 2 - 34;
    const center = size / 2;
    const angle = i => (Math.PI * 2 * i) / metrics.length - Math.PI / 2;

    const svg = d3.select(container).append("svg")
      .attr("width", size).attr("height", size);
    const g = svg.append("g").attr("transform", `translate(${center},${center})`);

    for (let level = 1; level <= levels; level++) {
      const r = (radius * level) / levels;
      g.append("polygon")
        .attr("points", metrics.map((m, i) =>
          `${Math.cos(angle(i)) * r},${Math.sin(angle(i)) * r}`).join(" "))
        .attr("fill", "none")
        .attr("stroke", "#d8dde3");
    }

    metrics.forEach((m, i) => {
      g.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", Math.cos(angle(i)) * radius)
        .attr("y2", Math.sin(angle(i)) * radius)
        .attr("stroke", "#d8dde3");
      g.append("text")
        .attr("x", Math.cos(angle(i)) * (radius + 16))
        .attr("y", Math.sin(angle(i)) * (radius + 14) + 4)
        .attr("text-anchor", "middle")
        .attr("font-size", 9.5)
        .text(t(m.axis));
    });

    const pts = metrics.map((m, i) => {
      const r = (radius * Math.min(m.value, maxValue)) / maxValue;
      return `${Math.cos(angle(i)) * r},${Math.sin(angle(i)) * r}`;
    });
    g.append("polygon")
      .attr("points", pts.join(" "))
      .attr("fill", color).attr("fill-opacity", 0.35)
      .attr("stroke", color).attr("stroke-width", 2);
    metrics.forEach((m, i) => {
      const r = (radius * Math.min(m.value, maxValue)) / maxValue;
      g.append("circle")
        .attr("cx", Math.cos(angle(i)) * r)
        .attr("cy", Math.sin(angle(i)) * r)
        .attr("r", 3).attr("fill", color)
        .append("title").text(`${t(m.axis)}: ${m.value}`);
    });
  },
};
