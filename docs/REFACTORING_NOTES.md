# Refactoring notes

This repository publishes the visualization system of

> Zhang, Zhang, Cui, Yin. *Visual Analysis for Name Disambiguation of
> Academic Papers* (in Chinese). Journal of Computer-Aided Design & Computer
> Graphics 34(11), 2022. DOI 10.3724/SP.J.1089.2022.19191

The project had never been organized for release: the working materials were
a collection of prototype folders accumulated during development. This
document records what the original materials were, what was rewritten, every
behavioral difference, and the caveats.

## 1. What the original prototype was

The system shown in the paper and the demo video was an **Axure RP prototype**
(exported HTML) whose panels embedded hand-written visualization pages via
iframes. It was not runnable outside the author's machine:

- iframes pointed at absolute local paths (`C:/ZPY/code/可视化/...`) and at
  two Live Server ports (`127.0.0.1:5502`, `127.0.0.1:5503`);
- each view carried its own hardcoded data: 29 per-author word-cloud HTML
  files, 29 per-author direction-chart HTML files, CSVs and JSON snapshots
  (several near-identical copies, `z1`–`z4`);
- the collaboration network used **ZoomCharts** (commercial), the year chart
  used **amCharts** (proprietary free tier), the bipartite journal chart used
  **viz.js** loaded over plain HTTP from a now-unreliable host, plus d3 v3/v4
  and ECharts in other views;
- the "analysis mode" tab embedded a scraped third-party WordPress page
  containing a d3 concept map.

`original_code/` archives the hand-written pieces of that prototype (the
module folders with Chinese names; a mapping is given below). The Axure
exports, `.rp` design sources, the demo video and third-party example
collections are **not** in the repository.

| Archived folder | Content |
|---|---|
| `z1`–`z4/` | snapshots of the collaboration module (ZoomCharts network + viz.js bipartite journal chart, linked across iframes) |
| `关联关系/`, `关联关系_锁/` | earlier network-graph variants ("association relations", locked variant) |
| `关联程度/` | dumbbell charts ("association degree"), d3 v4 + CSV |
| `词云/` | 29 per-author word-cloud pages, d3 v3 + d3-cloud |
| `小发文方向/` | 29 per-author research-direction charts, ECharts |
| `发文年份/` | publications-per-year bars, amCharts |
| `发文方向影响因子/` | author–journal bipartite chart variants, viz.js |
| `雷达期刊/`, `雷达合作论文数/` | radar-chart views, d3 v3 |
| `右键/` | right-click context-menu experiment |
| `分析模式/` | "analysis mode" concept-map page (scraped WordPress page) |

### Changes applied to the archive

`original_code/` is otherwise unmodified, with two exceptions made at
archive time (before the first commit):

1. **Anonymization.** Several files hardcoded real teacher names and
   internal employee IDs from the non-public Beijing University of
   Technology dataset. All such strings were replaced consistently
   (`Teacher-A:1001` … `Teacher-Y`, IDs `1001`–`1013`), and old-machine
   path comments were stripped. The public-facing demo data (the
   29 pseudonymous English author names used in the paper's figures) was
   already anonymous and is unchanged.
2. **License compliance.** Bundled copies of the commercial
   `zoomcharts.js` library (and two archive zips) were removed; the
   archived pages reference the ZoomCharts CDN and no longer run as-is.

## 2. The rewrite

The app was rewritten from scratch as a **single-page static site** (vanilla
JavaScript + D3 v7, no build step, no backend, no npm). Everything the
prototype hardcoded is now derived at load time from one papers CSV
(`js/pipeline.js`), which also makes the paper's query module real: users can
import their own CSV and export the corrected one.

| Paper component | Prototype | Rewrite |
|---|---|---|
| Query module (§6.1) | non-functional Axure mockup | working search, year range, CSV import/export (`js/query.js`, `js/csv.js`) |
| Association degree (§6.2) | d3 v4 dumbbell, hardcoded CSVs, one file per metric | one dumbbell view with metric switch; scores computed from data (`js/dumbbell.js`) |
| Collaboration network (§6.3) | ZoomCharts `focusnodes` graph | D3 force-directed layout — what the paper actually describes — with research-direction hulls, selection, strong links, context menu (`js/network.js`) |
| Journal view (§6.3) | viz.js bipartite bars | d3-sankey flow diagram — the paper describes a Sankey (`js/sankey.js`) |
| Full-screen mode (§6.3(3)) | separate Axure page | modal with related-papers list, graph, strong-links list (`js/app.js`) |
| Node add/delete (§6.3(3)) | context-menu mockup only | implemented: delete removes the author from the team; split partitions an author into `Name 01/02/…` by collaborator components, solo papers assigned by keyword overlap (`js/state.js`) — reproduces case study 1 |
| Strong-link feedback (§6.3(3)) | not implemented | a user-confirmed collaboration counts as extra co-publications in the association-degree score, so confirming a link visibly raises both authors' association (`CONFIG.strongLinkFeedback`, default +2) — the paper feeds strong links back into the classifier, which is external here |
| Generated disambiguation candidates (§2, S1) | not implemented | the author dropdown lists auto-detected candidates first: names whose co-authors fall into ≥2 disconnected groups once the name is removed — the structural signature of the Wang Wei / Li Jie cases (`Pipeline.disambiguationCandidates`) |
| Publication-trend comparison (§7.2, fig. 10 / G6) | separate per-author pages | the author-info year chart overlays the team-average trend as a dashed line, so "active only before 2015, unlike the team" is visible at a glance |
| Basic information (§6.4) | Axure tables + per-author HTML files | paper table, author profile (year bars, keyword cloud, radar), journal profile (`js/tabs.js` + widgets) |
| Author/paper classification (§5) | not in this project | external by design; the multi-view GCN lives in the [MVMA-GCN](https://github.com/pengyu-zhang/MVMA-GCN) repository. The app accepts per-paper `direction` labels via CSV and otherwise uses a journal-majority heuristic (`js/pipeline.js`) |
| Unique author colors (§6.3) | fixed hand-picked lists copied into 4 files | the paper's greedy RGB-distance algorithm, seeded and deterministic (`js/colors.js`) |
| Analysis mode | scraped WordPress concept map | radial concept map: author → directions → keywords (`js/analysis.js`) |

### Decisions the paper does not specify

- **Association-degree formula.** The paper lists the ingredients
  (co-publication count, research-direction overlap, connection centrality)
  but not the combination. Implemented as a weighted sum (0.40 / 0.35 / 0.25)
  of normalized components; direction overlap is the cosine similarity
  between the author's and the team's direction histograms. Weights are
  configurable (`CONFIG.associationWeights`).
- **Publication score** = publication count normalized by the team maximum.
- **Team expansion on search.** Papers containing the searched name seed the
  set; the team then closes over co-authorship (fixpoint), matching the
  figures where a search surfaces entire collaboration teams.
- **Radar axes** (author profile) follow the prototype: papers, citations,
  h-index, g-index, sociability, diversity, activity — normalized to 0–5.
- **Journal impact factors** are not in the demo data; a deterministic
  hash-based placeholder in [0.8, 8.0] is shown.

### Beyond-paper behavior (switches in `js/config.js`)

| Switch | Default | Effect |
|---|---|---|
| `enhancements.directionDonutOnDoubleClick` | on | double-clicking a node shows its direction distribution as a donut (the prototype had a ZoomCharts pie drill-down) |
| `enhancements.persistStrongLinks` | on | strong links survive page reloads (localStorage) |
| `enhancements.dumbbellFiltersViews` | on | clicking an author label in the dumbbell chart hides/shows that author in the network and journal views |
| `language` | `en` | UI language (`en`/`zh`, runtime toggle) |

Determinism: colors, word-cloud layout and the initial network layout all
use a fixed seed (`CONFIG.seed`); the force simulation is warmed up with a
fixed number of synchronous ticks before first paint.

## 3. Data

The BJUT dataset used for the paper's case studies (2011–2020, ~4,000
papers, employee IDs) is **non-public** and is not distributed in any form;
all records derived from it were removed or anonymized (see §1). The bundled
`data/demo_papers.csv` (108 papers, 29 authors, 17 journals) is synthesized
by `scripts/generate_demo_data.py` with a fixed seed:

- the 29 pseudonymous authors, their journal relationships and the
  collaboration edges are taken from the archived prototype data
  (`original_code/z1/`), i.e. the same team shown in the paper's figures;
- titles, keywords, years and citation counts are synthetic;
- the case-study-2 anomaly is planted: *Ao Yu* has one collaborator, one
  journal, one shared paper (2014), and no publications after 2015.

The DBLP/ACM datasets mentioned in the paper belong to the classification
model's evaluation and are handled in the MVMA-GCN repository.

## 4. Bugs found in the original prototype

Recorded for reference; none of this code is used by the rewrite.

1. `关联程度/总_新.html`: the color scale maps a numeric field through a
   scale whose domain is author names (`color(d.value2)`), so circle colors
   were effectively arbitrary; the color table also contained a stray tab
   character in `'\t#00FF7F'`.
2. `词云/*.html`: word sizes were `10 + Math.random() * 60` — unrelated to
   term frequency and different on every reload.
3. Cross-view identity relied on colors being copied by hand into at least
   four files; the copies had already diverged (e.g. `Yueheng Yang` appears
   in the bipartite chart's color map but had no data rows).
4. `viz.js` was loaded over plain HTTP; `d3.v3`, `d3.v4` and d3 v3-era
   plugins were mixed across views.
5. The Axure main page linked views by absolute `C:` paths and two hardcoded
   localhost ports, so module linkage silently no-opped when either server
   was down.

## 5. Verification

- `scripts/smoke_test.sh` (Git Bash, Linux, WSL): data-generator determinism
  against the committed CSV + HTTP 200 for all 22 assets. Passed on Windows
  Git Bash.
- Headless-browser check (Chromium via Playwright, not part of the repo):
  22/22 interaction checks passed with zero console errors — all views
  render; search expands to the 29-author team; node click cross-filters the
  Sankey and fills the author profile; the planted anomaly ranks lowest in
  association with publication score 0.57; strong-link marking, full-screen
  related-papers/strong-links lists, analysis mode, journal tab, author
  split (`Jinpei Cheng 01/02/03`), language toggle and CSV export all work.
- Docker image builds and serves the same content (nginx, static copy).

## 6. Caveats

- The rewrite is a faithful reimplementation of the interaction design, not
  a pixel-level reproduction of the Axure prototype shown in the demo video;
  visual styling differs.
- Automatic assignment of newly imported papers to previously split author
  nodes (paper §7.1: "next year's papers are assigned to Wang Wei 01
  automatically") belongs to the backend classifier and is out of scope for
  this frontend; splits apply to the current session's dataset and are
  preserved through Export CSV.
- The user study (paper §8) applies to the original prototype, not to this
  reimplementation.
- Association-degree scores depend on the unspecified weights above; rankings
  in the demo match the paper's narrative but absolute values are not
  comparable to anything in the paper.
