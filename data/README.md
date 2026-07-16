# Data

## Bundled demo dataset

`demo_papers.csv` is a synthetic demo dataset bundled with the repository
(no download needed). It reproduces the anonymized 29-author team used in
the paper's figures and demo video, including the planted suspicious node
"Ao Yu" from case study 2. Regenerate it deterministically with:

```bash
bash scripts/prepare_data.sh
```

The dataset used for the case studies in the paper (Beijing University of
Technology, 2011–2020, ~4,000 papers) is **not public** and is not included;
all names, employee IDs and paper records from it have been removed or
anonymized throughout this repository.

## CSV format

One row per paper. The app derives every view (collaboration network,
association-degree scores, journal flows, keyword clouds, year histograms,
radar metrics) from this table at load time — you can bring your own data
via the **Import CSV** button.

| Column | Required | Description |
|---|---|---|
| `id` | no | Paper identifier (auto-generated when missing) |
| `title` | yes | Paper title |
| `year` | no | Publication year (integer) |
| `journal` | no | Journal or venue name |
| `authors` | yes | Author names, separated by `;` |
| `keywords` | no | Keywords, separated by `;` |
| `citations` | no | Citation count (integer) |
| `direction` | no | Research-direction label for the paper, e.g. produced by an external classifier such as [MVMA-GCN](https://github.com/pengyu-zhang/MVMA-GCN); without it, a journal-based heuristic is used |

Files must be UTF-8 encoded. Fields containing commas must be quoted
(standard CSV rules).
