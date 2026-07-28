/* Basic-information module (paper section 6.4): three tabs with the raw
 * paper table, per-author details (publications, years, keywords,
 * direction, radar) and per-journal details. */
const Tabs = {
  init() {
    document.querySelectorAll("#panel-info .tab").forEach(btn => {
      btn.addEventListener("click", () => this.activate(btn.dataset.tab));
    });
    State.on("dataset", () => {
      this.renderPapers();
      this.renderAuthor();
      this.renderJournal();
    });
    State.on("selection", () => {
      const last = State.selectedAuthors[State.selectedAuthors.length - 1];
      if (last) this.currentAuthor = last;
      this.renderAuthor();
    });
    document.addEventListener("langchange", () => {
      this.renderPapers(); this.renderAuthor(); this.renderJournal();
    });
  },

  currentAuthor: null,
  currentJournal: null,

  activate(tab) {
    document.querySelectorAll("#panel-info .tab").forEach(b =>
      b.classList.toggle("active", b.dataset.tab === tab));
    document.getElementById("info-papers").hidden = tab !== "papers";
    document.getElementById("info-author").hidden = tab !== "author";
    document.getElementById("info-journal").hidden = tab !== "journal";
  },

  showAuthor(name) {
    this.currentAuthor = name;
    this.activate("author");
    this.renderAuthor();
  },

  showJournal(name) {
    this.currentJournal = name;
    this.activate("journal");
    this.renderJournal();
  },

  renderPapers() {
    const el = document.getElementById("info-papers");
    const ds = State.dataset;
    if (!ds) { el.innerHTML = ""; return; }
    const colorOf = name => ds.authors.get(name)?.color || "#888";
    const rows = ds.papers.map(p => `
      <tr>
        <td>${this.esc(p.title)}</td>
        <td>${p.year || ""}</td>
        <td>${this.esc(p.journal)}</td>
        <td>${p.authors.map(a =>
          `<span class="author-chip" style="background:${colorOf(a)}">${this.esc(a)}</span>`).join("")}</td>
        <td>${this.esc(p.keywords.join(", "))}</td>
      </tr>`).join("");
    el.innerHTML = `
      <table class="papers">
        <thead><tr>
          <th>${t("colTitle")}</th><th>${t("colYear")}</th><th>${t("colJournal")}</th>
          <th>${t("colAuthors")}</th><th>${t("colKeywords")}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  },

  renderAuthor() {
    const el = document.getElementById("info-author");
    const ds = State.dataset;
    const author = ds && this.currentAuthor ? ds.authors.get(this.currentAuthor) : null;
    if (!author) {
      el.innerHTML = `<div class="placeholder">${t("selectAuthorHint")}</div>`;
      return;
    }
    el.innerHTML = `
      <div class="info-grid">
        <div class="info-block info-meta" style="min-width:200px">
          <h4>${t("author")}</h4>
          <b style="color:${author.color}">${this.esc(author.name)}</b><br>
          ${t("direction")}: ${this.esc(author.direction)}<br>
          ${t("publications")}: ${author.papers.length} &nbsp;|&nbsp; ${t("citations")}: ${author.citations}<br>
          ${t("coauthors")}: ${author.coauthors.size} &nbsp;|&nbsp; ${t("journals")}: ${author.journals.size}<br>
          ${t("yearsActive")}: ${d3.min([...author.years.keys()]) || "-"}–${d3.max([...author.years.keys()]) || "-"}
        </div>
        <div class="info-block"><h4>${t("publicationsPerYear")}</h4><div id="author-years"></div></div>
        <div class="info-block"><h4>${t("keywordCloud")}</h4><div id="author-cloud"></div></div>
        <div class="info-block"><h4>${t("metrics")}</h4><div id="author-radar"></div></div>
      </div>`;
    YearBars.render(document.getElementById("author-years"), author, ds);
    WordCloud.render(document.getElementById("author-cloud"), author);
    Radar.render(document.getElementById("author-radar"), Pipeline.radarMetrics(author, ds), author.color);
  },

  renderJournal() {
    const el = document.getElementById("info-journal");
    const ds = State.dataset;
    const journal = ds && this.currentJournal ? ds.journals.get(this.currentJournal) : null;
    if (!journal) {
      el.innerHTML = `<div class="placeholder">${t("selectJournalHint")}</div>`;
      return;
    }
    const authorCounts = new Map();
    for (const p of journal.papers) {
      for (const a of p.authors) authorCounts.set(a, (authorCounts.get(a) || 0) + 1);
    }
    const chips = [...authorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => {
        const color = ds.authors.get(name)?.color || "#888";
        return `<span class="author-chip" style="background:${color}">${this.esc(name)} (${count})</span>`;
      }).join(" ");
    el.innerHTML = `
      <div class="info-grid">
        <div class="info-block info-meta" style="min-width:260px">
          <h4>${t("journal")}</h4>
          <b>${this.esc(journal.name)}</b><br>
          ${t("direction")}: ${this.esc(journal.direction)}<br>
          ${t("impactFactor")}: ${journal.impactFactor}<br>
          ${t("publications")}: ${journal.papers.length}
        </div>
        <div class="info-block" style="max-width:420px">
          <h4>${t("authorsInJournal")}</h4>${chips}
        </div>
      </div>`;
  },

  esc(s) {
    return String(s).replace(/[&<>"]/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },
};
