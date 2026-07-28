/* Application bootstrap: load the demo CSV, build the dataset, wire the
 * four modules together (query, association degree, collaboration +
 * journals, basic information) and the full-screen mode. */
const App = {
  async init() {
    applyI18n();
    Query.init();
    Dumbbell.init();
    Network.init();
    SankeyView.init();
    Tabs.init();
    Analysis.init();
    this.initCenterTabs();
    this.initFullscreen();
    State.restoreStrongLinks();

    State.on("stronglinks", () => this.renderStrongList());
    State.on("selection", () => this.renderRelatedPapers());
    document.addEventListener("langchange", () => {
      this.renderStrongList();
      this.renderRelatedPapers();
    });

    try {
      const res = await fetch(CONFIG.dataUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      State.allPapers = Pipeline.parsePapers(CSV.parse(await res.text()));
    } catch (err) {
      document.getElementById("info-papers").innerHTML =
        `<div class="placeholder">Failed to load ${CONFIG.dataUrl} (${err.message}). ` +
        `Serve this folder over HTTP (see scripts/serve.sh) or import a CSV manually.</div>`;
      State.allPapers = [];
    }
    Query.populate();
    State.applyQuery();
  },

  initCenterTabs() {
    document.querySelectorAll("#center-tabs .tab").forEach(btn => {
      btn.addEventListener("click", () => this.showCenterTab(btn.dataset.tab));
    });
  },

  showCenterTab(tab) {
    document.querySelectorAll("#center-tabs .tab").forEach(b =>
      b.classList.toggle("active", b.dataset.tab === tab));
    document.getElementById("network-container").hidden = tab !== "collaboration";
    document.getElementById("direction-legend").hidden = tab !== "collaboration";
    document.getElementById("analysis-container").hidden = tab !== "analysis";
    if (tab === "analysis") Analysis.render();
    else Network.renderAll();
  },

  /* Full-screen collaboration mode (paper section 6.3 (3)): related papers
   * on the left, the graph in the middle, strong links on the right. */
  initFullscreen() {
    const modal = document.getElementById("fullscreen-modal");
    document.getElementById("btn-fullscreen").addEventListener("click", () => {
      modal.hidden = false;
      if (Network.instances.length < 2) {
        Network.instances.push(Network.createInstance("#fs-network"));
      }
      Network.render(Network.instances[1]);
      this.renderStrongList();
      this.renderRelatedPapers();
    });
    document.getElementById("btn-close-fullscreen").addEventListener("click", () => {
      modal.hidden = true;
      Network.instances.splice(1);
    });
  },

  renderStrongList() {
    const el = document.getElementById("fs-strong-list");
    if (!el) return;
    if (!State.strongLinks.length) {
      el.innerHTML = `<div class="placeholder">${t("noStrongLinks")}</div>`;
      return;
    }
    el.innerHTML = State.strongLinks.map(key => {
      const [a, b] = key.split("||");
      return `<div class="strong-link-item">
        <button data-key="${key}">${t("remove")}</button>
        ${Tabs.esc(a)} — ${Tabs.esc(b)}
      </div>`;
    }).join("");
    el.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const [a, b] = btn.dataset.key.split("||");
        State.toggleStrongLink(a, b);
      });
    });
  },

  renderRelatedPapers() {
    const el = document.getElementById("fs-papers-list");
    if (!el || !State.dataset) return;
    const selected = State.selectedAuthors;
    if (selected.length < 2) {
      el.innerHTML = `<div class="placeholder">${t("selectTwoNodes")}</div>`;
      return;
    }
    const shared = State.dataset.papers.filter(p =>
      selected.every(a => p.authors.includes(a)));
    if (!shared.length) {
      el.innerHTML = `<div class="placeholder">${Tabs.esc(selected.join(" + "))}: 0 ${t("papersCount")}</div>`;
      return;
    }
    el.innerHTML = shared.map(p => `
      <div class="fs-paper">
        <div>${Tabs.esc(p.title)}</div>
        <div class="meta">${p.year || ""} · ${Tabs.esc(p.journal)} · ${Tabs.esc(p.authors.join("; "))}</div>
      </div>`).join("");
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
