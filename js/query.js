/* Query module (paper section 6.1): search by author + year range,
 * CSV import/export. */
const Query = {
  init() {
    document.getElementById("btn-search").addEventListener("click", () => this.search());
    document.getElementById("btn-reset").addEventListener("click", () => this.reset());
    document.getElementById("btn-import").addEventListener("click", () =>
      document.getElementById("file-input").click());
    document.getElementById("file-input").addEventListener("change", e => this.importFile(e));
    document.getElementById("btn-export").addEventListener("click", () => this.exportCsv());
    document.getElementById("btn-lang").addEventListener("click", toggleLanguage);
    document.addEventListener("langchange", () => this.populate());
  },

  populate() {
    const authors = [...new Set(State.allPapers.flatMap(p => p.authors))].sort();
    const years = [...new Set(State.allPapers.map(p => p.year).filter(Boolean))].sort();

    // after a split, the searched base name is gone from the data but still
    // matches its "Name 01/02/…" variants — keep it selectable
    const q = State.query.author;
    if (q && !authors.includes(q) && authors.some(a => a.startsWith(q + " "))) {
      authors.unshift(q);
    }

    const fill = (id, values, anyLabel, current) => {
      const sel = document.getElementById(id);
      sel.innerHTML = "";
      const any = document.createElement("option");
      any.value = "";
      any.textContent = anyLabel;
      sel.appendChild(any);
      for (const v of values) {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        if (String(current ?? "") === String(v)) opt.selected = true;
        sel.appendChild(opt);
      }
    };
    fill("author-select", authors, t("allAuthors"), State.query.author);
    fill("start-year", years, t("anyYear"), State.query.startYear);
    fill("end-year", years, t("anyYear"), State.query.endYear);
  },

  search() {
    State.query = {
      author: document.getElementById("author-select").value,
      startYear: +document.getElementById("start-year").value || null,
      endYear: +document.getElementById("end-year").value || null,
    };
    State.applyQuery();
  },

  reset() {
    State.query = { author: "", startYear: null, endYear: null };
    this.populate();
    State.applyQuery();
  },

  importFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const papers = Pipeline.parsePapers(CSV.parse(reader.result));
      if (!papers.length) {
        alert("No usable rows found. Expected columns: title, year, journal, authors, keywords[, citations][, direction]");
        return;
      }
      State.allPapers = papers;
      State.query = { author: "", startYear: null, endYear: null };
      this.populate();
      State.applyQuery();
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  },

  exportCsv() {
    const records = State.allPapers.map(p => ({
      id: p.id,
      title: p.title,
      year: p.year || "",
      journal: p.journal,
      authors: p.authors.join(";"),
      keywords: p.keywords.join(";"),
      citations: p.citations,
    }));
    const csv = CSV.stringify(records, ["id", "title", "year", "journal", "authors", "keywords", "citations"]);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "disambiguated_papers.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
