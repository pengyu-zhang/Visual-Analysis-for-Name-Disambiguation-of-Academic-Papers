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

    // program-generated disambiguation candidates (paper section 2, S1)
    const candidates = Pipeline.disambiguationCandidates(State.allPapers);

    const sel = document.getElementById("author-select");
    sel.innerHTML = "";
    sel.appendChild(new Option(t("allAuthors"), ""));
    const addGroup = (label, names) => {
      if (!names.length) return;
      const group = document.createElement("optgroup");
      group.label = label;
      for (const name of names) {
        group.appendChild(new Option(name, name, false, name === q));
      }
      sel.appendChild(group);
    };
    addGroup(t("candidateAuthors"), candidates);
    addGroup(t("otherAuthors"), authors.filter(a => !candidates.includes(a)));

    const fill = (id, values, anyLabel, current) => {
      const el = document.getElementById(id);
      el.innerHTML = "";
      el.appendChild(new Option(anyLabel, ""));
      for (const v of values) {
        el.appendChild(new Option(v, v, false, String(current ?? "") === String(v)));
      }
    };
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
