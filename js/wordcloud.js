/* Keyword word cloud for one author (paper: author-info tab). Uses the
 * d3-cloud layout with a seeded PRNG so the layout is reproducible. */
const WordCloud = {
  render(container, author) {
    container.innerHTML = "";
    const entries = [...author.keywords.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, CONFIG.wordcloud.maxWords);
    if (!entries.length) return;

    const width = 340, height = 180;
    const maxCount = entries[0][1];
    const size = d3.scaleSqrt().domain([1, Math.max(2, maxCount)]).range([11, 30]);
    const words = entries.map(([text, count]) => ({ text, size: size(count), count }));

    const rng = mulberry32(CONFIG.seed);
    d3.layout.cloud()
      .size([width, height])
      .words(words)
      .padding(2)
      .rotate(() => (rng() < 0.5 ? 0 : 90))
      .font("Segoe UI")
      .fontSize(d => d.size)
      .random(rng)
      .on("end", laid => {
        const svg = d3.select(container).append("svg")
          .attr("width", width).attr("height", height)
          .append("g")
          .attr("transform", `translate(${width / 2},${height / 2})`);
        svg.selectAll("text").data(laid).join("text")
          .attr("font-family", "Segoe UI, sans-serif")
          .attr("font-size", d => d.size)
          .attr("fill", author.color)
          .attr("text-anchor", "middle")
          .attr("transform", d => `translate(${d.x},${d.y}) rotate(${d.rotate})`)
          .text(d => d.text)
          .append("title").text(d => `${d.text}: ${d.count}`);
      })
      .start();
  },
};
