#!/usr/bin/env python3
"""Generate the demo paper dataset (data/demo_papers.csv).

The demo dataset reproduces the anonymized author team used in the paper's
figures and demo video (29 authors around the searched name "Jinpei Cheng").
The collaboration structure and the author-journal relationships are taken
from the archived prototype data (original_code/z1/z/b/data.json and
original_code/z1/z/a/index.html); paper titles, years, keywords and citation
counts are synthesized deterministically so that the dataset tells the same
story as the paper's case study 2:

  * "Ao Yu" is the planted suspicious node: many publications, but a low
    association with the team (single journal, single collaborator, papers
    concentrated before 2015).

Standard library only. Deterministic: fixed random seed, no timestamps.

Usage:
    python scripts/generate_demo_data.py [--out data/demo_papers.csv]
"""

import argparse
import csv
import random
from pathlib import Path

SEED = 42

HUB = "Jinpei Cheng"
SUSPECT = "Ao Yu"

# Research directions with journals and keyword pools.
DIRECTIONS = {
    "Energy & Thermal Engineering": {
        "journals": [
            "Fuel",
            "THERMAL SCIENCE",
            "Materials Science Forum",
            "International Corrosion Conference Series",
        ],
        "keywords": [
            "combustion", "biomass fuel", "heat transfer", "thermal analysis",
            "pyrolysis", "corrosion resistance", "coal gasification",
            "energy efficiency", "flame propagation", "porous media",
            "exhaust emission", "thermodynamic cycle",
        ],
    },
    "Structural & Disaster Engineering": {
        "journals": [
            "Journal of Natural Disasters",
            "MATEC Web of Conferences",
            "NONLINEAR DYNAMICS",
            "Composite Structures",
            "INTERNATIONAL JOURNAL OF FATIGUE",
            "Scientia Sinica",
        ],
        "keywords": [
            "seismic response", "fatigue life", "composite laminate",
            "nonlinear vibration", "structural health monitoring",
            "earthquake hazard", "crack propagation", "damage detection",
            "risk assessment", "finite element analysis", "buckling",
            "dynamic loading",
        ],
    },
    "Remote Sensing & Photogrammetry": {
        "journals": [
            "ISPRS JOURNAL OF PHOTOGRAMMETRY AND REMOTE SENSING",
        ],
        "keywords": [
            "point cloud", "image registration", "LiDAR", "land cover",
            "change detection", "satellite imagery", "feature extraction",
            "digital elevation model", "object detection", "semantic segmentation",
        ],
    },
    "Acoustics & Vibration": {
        "journals": [
            "Proceedings of Meetings on Acoustics",
            "International Congress on Sound and Vibration",
        ],
        "keywords": [
            "noise control", "acoustic emission", "sound absorption",
            "modal analysis", "ultrasonic testing", "vibration isolation",
            "wave propagation", "acoustic metamaterial", "resonance",
            "signal denoising",
        ],
    },
    "Sensors & Space Science": {
        "journals": [
            "IEEE Sensors Journal",
            "ASTROPHYSICS AND SPACE SCIENCE",
            "APPLIED SURFACE SCIENCE",
        ],
        "keywords": [
            "gas sensor", "thin film", "surface functionalization",
            "stellar spectra", "cosmic ray", "MEMS", "photodetector",
            "nanostructure", "orbital dynamics", "sensor calibration",
        ],
    },
    # The suspicious node's true field. The demo classifier will still lump
    # Ao Yu into the team (as in the paper case study), the anomaly is meant
    # to be discovered through the association-degree and journal views.
    "Electrochemistry": {
        "journals": [
            "International Journal of Electrochemical Science",
        ],
        "keywords": [
            "electrode material", "cyclic voltammetry", "electrolyte",
            "supercapacitor", "corrosion inhibitor", "electrodeposition",
            "impedance spectroscopy", "lithium-ion battery",
        ],
    },
}

# Author -> journals, from the archived bipartite chart data
# (original_code/z1/z/a/index.html).
AUTHOR_JOURNALS = {
    "Jinpei Cheng": [
        "MATEC Web of Conferences",
        "International Journal of Electrochemical Science",
        "Materials Science Forum",
        "International Congress on Sound and Vibration",
        "Proceedings of Meetings on Acoustics",
        "Fuel",
        "International Corrosion Conference Series",
        "THERMAL SCIENCE",
        "ISPRS JOURNAL OF PHOTOGRAMMETRY AND REMOTE SENSING",
        "INTERNATIONAL JOURNAL OF FATIGUE",
        "ASTROPHYSICS AND SPACE SCIENCE",
        "Scientia Sinica",
        "Journal of Natural Disasters",
    ],
    "Ao Yu": ["International Journal of Electrochemical Science"],
    "Chen Yang": ["Materials Science Forum", "THERMAL SCIENCE", "Fuel"],
    "Xiaosong Xue": [
        "Proceedings of Meetings on Acoustics",
        "ISPRS JOURNAL OF PHOTOGRAMMETRY AND REMOTE SENSING",
        "INTERNATIONAL JOURNAL OF FATIGUE",
    ],
    "Xin Li": [
        "International Corrosion Conference Series",
        "THERMAL SCIENCE",
        "Fuel",
    ],
    "Shu Chien": [
        "ISPRS JOURNAL OF PHOTOGRAMMETRY AND REMOTE SENSING",
        "Journal of Natural Disasters",
    ],
    "Runsheng Chen": [
        "ISPRS JOURNAL OF PHOTOGRAMMETRY AND REMOTE SENSING",
        "INTERNATIONAL JOURNAL OF FATIGUE",
    ],
    "Yongfei Zheng": ["INTERNATIONAL JOURNAL OF FATIGUE", "THERMAL SCIENCE", "Fuel"],
    "YanYan Zhao": ["INTERNATIONAL JOURNAL OF FATIGUE", "Scientia Sinica"],
    "Lifei Zhang": ["THERMAL SCIENCE", "Fuel", "Journal of Natural Disasters"],
    "Ligang Zhou": ["THERMAL SCIENCE", "Fuel"],
    "Yingming Sheng": [
        "THERMAL SCIENCE",
        "Journal of Natural Disasters",
        "MATEC Web of Conferences",
    ],
    "Xiachen Zhi": [
        "Journal of Natural Disasters",
        "THERMAL SCIENCE",
        "MATEC Web of Conferences",
    ],
    "Weidong Sun": [
        "Journal of Natural Disasters",
        "THERMAL SCIENCE",
        "MATEC Web of Conferences",
    ],
    "Bin Fu": [
        "MATEC Web of Conferences",
        "Journal of Natural Disasters",
        "Proceedings of Meetings on Acoustics",
    ],
    "Jochen Hoefs": [
        "MATEC Web of Conferences",
        "Journal of Natural Disasters",
        "Proceedings of Meetings on Acoustics",
    ],
    "Shan Gao": ["Composite Structures", "Fuel", "Proceedings of Meetings on Acoustics"],
    "Fukun Chen": ["Composite Structures", "Fuel", "Proceedings of Meetings on Acoustics"],
    "Yueheng Yang": ["Scientia Sinica", "International Congress on Sound and Vibration"],
    "Lihong Chen": ["Journal of Natural Disasters", "Composite Structures"],
    "Zongyao Wen": ["Journal of Natural Disasters", "NONLINEAR DYNAMICS"],
    "Weibo Ka": ["Journal of Natural Disasters", "Proceedings of Meetings on Acoustics"],
    "Ding-Yu Lee": ["Journal of Natural Disasters", "NONLINEAR DYNAMICS"],
    "Si-Shen Feng": ["Journal of Natural Disasters", "APPLIED SURFACE SCIENCE"],
    "Ying Wang": ["APPLIED SURFACE SCIENCE", "Proceedings of Meetings on Acoustics"],
    "Yan-Ting Shiu": ["APPLIED SURFACE SCIENCE", "Proceedings of Meetings on Acoustics"],
    "Sung Sik Hur": ["IEEE Sensors Journal", "ASTROPHYSICS AND SPACE SCIENCE"],
    "Yuhui Jiang": ["IEEE Sensors Journal", "ASTROPHYSICS AND SPACE SCIENCE"],
    "Li-Jing Chen": ["IEEE Sensors Journal", "ASTROPHYSICS AND SPACE SCIENCE"],
}

# Collaboration edges, from the archived network data
# (original_code/z1/z/b/data.json), plus a few edges connecting the
# sensors/space sub-team which was isolated in the prototype snapshot.
EDGES = [
    ("Jinpei Cheng", "Ao Yu"),  # exactly one shared paper (case study 2)
    ("Jinpei Cheng", "Chen Yang"),
    ("Jinpei Cheng", "Xiaosong Xue"),
    ("Jinpei Cheng", "Xin Li"),
    ("Jinpei Cheng", "Shu Chien"),
    ("Jinpei Cheng", "Runsheng Chen"),
    ("Jinpei Cheng", "Yongfei Zheng"),
    ("Jinpei Cheng", "YanYan Zhao"),
    ("Jinpei Cheng", "Lifei Zhang"),
    ("Jinpei Cheng", "Ligang Zhou"),
    ("Jinpei Cheng", "Yingming Sheng"),
    ("Jinpei Cheng", "Xiachen Zhi"),
    ("Jinpei Cheng", "Weidong Sun"),
    ("Jinpei Cheng", "Yueheng Yang"),
    ("Yongfei Zheng", "YanYan Zhao"),
    ("YanYan Zhao", "Lifei Zhang"),
    ("Lifei Zhang", "Ligang Zhou"),
    ("Lifei Zhang", "Yingming Sheng"),
    ("Lifei Zhang", "Xiachen Zhi"),
    ("Lifei Zhang", "Xiaosong Xue"),
    ("Lifei Zhang", "Xin Li"),
    ("Ligang Zhou", "Xiaosong Xue"),
    ("Ligang Zhou", "Shu Chien"),
    ("Ligang Zhou", "YanYan Zhao"),
    ("Yingming Sheng", "Xiaosong Xue"),
    ("Yingming Sheng", "Shu Chien"),
    ("Yingming Sheng", "Yongfei Zheng"),
    ("Xin Li", "Runsheng Chen"),
    ("Xiachen Zhi", "Xiaosong Xue"),
    ("Xiachen Zhi", "Bin Fu"),
    ("Weidong Sun", "Xiachen Zhi"),
    ("Bin Fu", "Jochen Hoefs"),
    ("Bin Fu", "Shan Gao"),
    ("Bin Fu", "Fukun Chen"),
    ("Bin Fu", "Yueheng Yang"),
    ("Bin Fu", "Lihong Chen"),
    ("Bin Fu", "Zongyao Wen"),
    ("Bin Fu", "Weibo Ka"),
    ("Bin Fu", "Ding-Yu Lee"),
    ("Ding-Yu Lee", "Si-Shen Feng"),
    ("Bin Fu", "Si-Shen Feng"),
    ("Si-Shen Feng", "Ying Wang"),
    ("Ying Wang", "Yan-Ting Shiu"),
    ("Yan-Ting Shiu", "Sung Sik Hur"),
    ("Sung Sik Hur", "Yuhui Jiang"),
    ("Sung Sik Hur", "Li-Jing Chen"),
    ("Yuhui Jiang", "Li-Jing Chen"),
]

TITLE_TEMPLATES = [
    "A study on {kw1} for {kw2}",
    "{Kw1} analysis of {kw2} under complex conditions",
    "Experimental investigation of {kw1} and its effect on {kw2}",
    "Modeling {kw1} with applications to {kw2}",
    "On the relationship between {kw1} and {kw2}",
    "An improved method for {kw1} in {kw2} scenarios",
    "Numerical simulation of {kw1} considering {kw2}",
    "{Kw1}-based evaluation of {kw2}",
]


def journal_direction(journal):
    for direction, spec in DIRECTIONS.items():
        if journal in spec["journals"]:
            return direction
    raise KeyError(journal)


def make_title(rng, journal):
    pool = DIRECTIONS[journal_direction(journal)]["keywords"]
    kw1, kw2 = rng.sample(pool, 2)
    template = rng.choice(TITLE_TEMPLATES)
    return template.format(kw1=kw1, kw2=kw2, Kw1=kw1.capitalize())


def make_keywords(rng, journal, n=4):
    pool = DIRECTIONS[journal_direction(journal)]["keywords"]
    return rng.sample(pool, min(n, len(pool)))


def shared_journal(rng, a, b):
    common = [j for j in AUTHOR_JOURNALS[a] if j in AUTHOR_JOURNALS[b]]
    if common:
        return rng.choice(common)
    return rng.choice(AUTHOR_JOURNALS[a])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parent.parent / "data" / "demo_papers.csv"),
    )
    args = parser.parse_args()

    rng = random.Random(SEED)
    papers = []

    def add_paper(authors, journal, year=None, keywords=None, title=None):
        year = year or rng.randint(2011, 2020)
        papers.append({
            "title": title or make_title(rng, journal),
            "year": year,
            "journal": journal,
            "authors": ";".join(authors),
            "keywords": ";".join(keywords or make_keywords(rng, journal)),
            "citations": max(0, int(rng.gauss(12, 9))),
        })

    # 1) One paper per collaboration edge (the Ao Yu edge stays single).
    #    Occasionally pull in a third collaborator that is a neighbour of both.
    neighbours = {}
    for a, b in EDGES:
        neighbours.setdefault(a, set()).add(b)
        neighbours.setdefault(b, set()).add(a)

    for a, b in EDGES:
        journal = shared_journal(rng, a, b)
        authors = [a, b]
        if a != SUSPECT and b != SUSPECT and rng.random() < 0.35:
            third = sorted((neighbours[a] & neighbours[b]) - {a, b})
            if third:
                authors.append(rng.choice(third))
        if SUSPECT in (a, b):
            # Case study 2: the single co-authored paper, an early one.
            add_paper(authors, journal, year=2014)
        else:
            add_paper(authors, journal)

    # 2) Strong pairs publish more than once.
    strong_pairs = [
        ("Jinpei Cheng", "Lifei Zhang"),
        ("Jinpei Cheng", "Yingming Sheng"),
        ("Lifei Zhang", "Ligang Zhou"),
        ("Bin Fu", "Jochen Hoefs"),
        ("Sung Sik Hur", "Yuhui Jiang"),
    ]
    for a, b in strong_pairs:
        for _ in range(rng.randint(1, 2)):
            add_paper([a, b], shared_journal(rng, a, b))

    # 3) Make sure every author-journal relationship from the archived
    #    bipartite data is covered by at least one paper.
    covered = set()
    for paper in papers:
        for author in paper["authors"].split(";"):
            covered.add((author, paper["journal"]))
    for author, journals in AUTHOR_JOURNALS.items():
        for journal in journals:
            if (author, journal) not in covered:
                coauthors = [author]
                candidates = sorted(
                    n for n in neighbours.get(author, ())
                    if journal in AUTHOR_JOURNALS[n] and n != SUSPECT
                )
                if candidates and rng.random() < 0.7:
                    coauthors.append(rng.choice(candidates))
                add_paper(coauthors, journal)
                for coauthor in coauthors:
                    covered.add((coauthor, journal))

    # 4) The suspicious node: many solo papers, all in one journal,
    #    concentrated before 2015 (case study 2, guideline G6).
    for _ in range(20):
        add_paper(
            [SUSPECT],
            "International Journal of Electrochemical Science",
            year=rng.randint(2011, 2015),
        )

    # 5) A few extra solo/dual papers for senior members so publication
    #    counts vary naturally.
    for author, extra in [
        ("Jinpei Cheng", 4), ("Lifei Zhang", 2), ("Bin Fu", 2),
        ("Yongfei Zheng", 1), ("Xiaosong Xue", 1), ("Sung Sik Hur", 1),
    ]:
        for _ in range(extra):
            add_paper([author], rng.choice(AUTHOR_JOURNALS[author]))

    papers.sort(key=lambda p: (p["year"], p["title"]))
    for i, paper in enumerate(papers, start=1):
        paper["id"] = f"P{i:03d}"

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["id", "title", "year", "journal", "authors", "keywords", "citations"],
        )
        writer.writeheader()
        writer.writerows(papers)

    authors = {a for p in papers for a in p["authors"].split(";")}
    journals = {p["journal"] for p in papers}
    print(f"wrote {out} : {len(papers)} papers, {len(authors)} authors, {len(journals)} journals")


if __name__ == "__main__":
    main()
