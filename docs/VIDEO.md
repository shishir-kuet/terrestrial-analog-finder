# Video pack — Team ghostblood

Everything needed to record the Space Apps submission video: the required
30-second demo, a longer walkthrough, and a 7-slide deck as the alternative.

Written for whoever records and edits. Voiceover is word-counted at roughly
**2.5 words per second** (a comfortable 150 wpm) — if you speak faster, add
breathing room rather than more words.

> **On the reference video you linked.** I cannot watch or listen to video, so
> I have not analysed it and will not pretend to. What I could read from the
> page: it is **Team Oikko, Chattogram — "Know Your Climate"**, a NASA Space
> Apps **2022** entry that reached **Global Nominee** on the *Earth Data
> Analysis* challenge. That is a good model to study for pacing and tone, and
> you should watch it yourselves with the structure below in hand. The scripts
> here are built from this project's actual data and screens.

---

## 1. The rule that governs everything

The Space Apps **Project Demo** field accepts **one** of:

- a video of **up to 30 seconds**, or
- a slide deck of **up to 7 slides**, title slide included.

A three-minute video does **not** satisfy that field. Record both: the
30-second cut goes in Project Demo, and the long version is linked from the
detailed description as supporting material. Host both on a **public link with
no login** (YouTube unlisted is fine; Drive needs "anyone with the link").

---

## 2. The 30-second demo — shot list

Screen recording with voiceover. No face, no intro card eating your seconds.
Record the screen at 1920×1080, browser zoom 100%, and hide bookmarks and
extensions. **72 words total.**

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:04 | Landing page. Reference spotlight rotating over a real hillshade. | "Which places on Earth actually look like the Moon?" |
| 0:04–0:09 | Explorer. Moon → *Connecting ridge*. Reference hillshade and its measurements visible. | "Pick a lunar site, measured from LRO LOLA elevation data." |
| 0:09–0:14 | Drag two weight sliders. Click **Find Earth analogs**. | "Decide what matters. Nothing is weighted behind your back." |
| 0:14–0:21 | Ranked list fills; map markers colour by index; click result #1. | "Five hundred and fifty-eight Earth windows ranked. Top match: the Transantarctic Dry Valleys, seventy-nine out of a hundred." |
| 0:21–0:27 | Detail panel: two hillshades side by side, per-feature table, contribution chart. | "And here is exactly why — feature by feature, with every missing measurement named." |
| 0:27–0:30 | Title card: project name, **team ghostblood**, live URL. | "Terrestrial Analog Finder. Team ghostblood." |

**Recording notes**

- Pre-run the search once so tiles and hillshades are cached; a cold load
  wastes four of your thirty seconds.
- Do the slider drag slowly enough to read, then cut. Do not show the loading
  spinner — cut straight to the filled list.
- Burn captions in. Judges often watch muted.
- Keep the mouse still except when it is doing the thing you are narrating.

---

## 3. The 4-minute presentation — slide-by-slide script

This is the longer video the team is recording. It is **supporting material**, not the
Project Demo field (§1): link it from the detailed description.

There is a **15-slide deck built for exactly this timing**, with every line below already
in it as speaker notes, so you can present from the deck alone:
<https://claude.ai/artifact/J26byTyp7dygS36wx8aiqy>

**≈580 words at 2.5 words per second.** Timings are cumulative; if you run long, cut
from slides 3 and 11 first — they are the two that survive compression.

| # | Slide | Time | What you say |
|---|---|---|---|
| 1 | Cover | 0:00–0:12 | "Terrestrial Analog Finder. Which places on Earth actually look like the Moon — measured, not argued. The image behind this title is not stock art: it is a real elevation render of a 12 kilometre window at the lunar south pole, from our own dataset." |
| 2 | The question | 0:12–0:28 | "Before hardware goes to the Moon, it gets tested somewhere on Earth. Which somewhere — and on what evidence?" *(pause)* |
| 3 | The problem | 0:28–0:50 | "Today that is settled by reputation. The Atacama. Haughton Crater. Devon Island. These are good choices and they were argued for by people who know the field — but they were not computed. There is no way to ask for the best match to one specific lunar ridge, on one property, at one scale, and see the evidence." |
| 4 | What we built | 0:50–1:05 | "So we built a search engine for Earth analogs where every score shows its working. Pick a planetary reference. Set what matters to you. Read why each place ranked where it did. 558 Earth windows, ranked in under a second." |
| 5 | Method 1 — window | 1:05–1:20 | "Three steps. First: cut the same window on all three bodies. LOLA for the Moon, CTX for Mars, Copernicus for Earth — twelve kilometres square everywhere. Big enough to hold a landform, small enough that a rover traverse fits inside it." |
| 6 | Method 2 — grid | 1:20–1:35 | "Second: put them all on one thirty-metre grid. Each window is reprojected into a local grid centred on its own coordinates, using the right figure for its body. This matters because slope and roughness are properties of the grid you measure them on — without this step, a five-metre lunar product and a thirty-metre Earth product are not comparable, and every number after it is meaningless." |
| 7 | Method 3 — statistics | 1:35–1:55 | "Third: describe every window with the same six numbers. Relief, median slope, ninetieth-percentile slope, short-baseline roughness, the hypsometric integral, and the full slope distribution. All datum-independent — absolute elevation cannot be compared across bodies, so we report it and never score it. Each difference is divided by that feature's inter-quartile range, so metres and degrees contribute comparably." |
| 8 | The score | 1:55–2:10 | "The score is a weighted distance, turned into an index from zero to a hundred. No model. No training data. You could re-derive it with a calculator. A hundred means identical on the features you picked; about thirty-seven means they differ by one inter-quartile range on average. It is not a probability and it is not a percentage." |
| 9 | The dataset | 2:10–2:30 | "570 locations: twelve planetary references, 558 Earth candidates, 469 with a complete window. Eight public datasets from NASA, USGS and ESA, every one cited with its licence and DOI inside the app. We also documented eight more sources we investigated and chose not to integrate, with the reason for each." |
| 10 | The result | 2:30–2:50 | "Here is one. Connecting ridge, near the lunar south pole. The top Earth analog is a survey cell in the Transantarctic Mountains, Dry Valleys, at seventy-eight and a half degrees south. Similarity index seventy-nine point one, at full data coverage. Both of these renders come out of the same pipeline at the same scale — and nobody picked this pair. The ranking did." |
| 11 | Why this rank | 2:50–3:08 | "Open any result and the score comes apart: both measured values per feature, how far apart they are, which feature is costing the match, and the slope and elevation distributions overlaid. Change a weight and the whole thing recomputes in front of you. There is no cached answer to disagree with." |
| 12 | Missing data | 3:08–3:22 | "Gaps are named, never filled in. Askja, in Iceland, is a famous analog site — and our tool refuses to score it, because its caldera lake is masked out and the window is only ninety-two percent valid. Ninety-one of 558 candidates were excluded from this search, each with its reason shown." |
| 13 | Robustness | 3:22–3:42 | "We tried to break our own ranking. Randomise every weight and the order barely moves — Spearman rho of nought point nine nine eight. Drop any single feature, still above nought point nine eight. Coarsen the grid, still fine. But halve the window to six kilometres and rho falls to nought point nine one. The result is scale dependent. That is a real limitation and it is on the methodology page, not hidden in a footnote." |
| 14 | What it is not | 3:42–3:55 | "So: a measured, reproducible shortlist, traceable to public archives. Not a probability. Not a landing-site recommendation. Not a habitability judgement. Gravity, atmosphere, radiation, illumination and regolith depth are not in this at all — and the nine limitations that follow from that sit next to the results they limit." |
| 15 | Close | 3:55–4:00 | "Terrestrial Analog Finder. Team ghostblood." |

**Recording notes**

- Present from the deck and record the screen; cut in a live app capture at slide 4 or
  slide 10 if you want movement.
- Pre-run the search once so tiles and hillshades are cached.
- Burn in captions. Judges often watch muted, and several numbers here are spoken.
- Record each slide's audio separately if that is easier — the timings are per slide,
  so nothing depends on a continuous take.

---

## 4. The 7-slide deck (alternative to the video)

Use this only if you submit slides **instead of** a video, in the Project Demo field.
Seven slides is the hard limit there, so this is a separate, tighter deck from the
15-slide presentation above: <https://claude.ai/artifact/8VeZLtmmDsUFk4fY83ebZ6>

| # | Slide | Carries |
|---|---|---|
| 1 | **Title** | Terrestrial Analog Finder · Team ghostblood · NASA Space Apps 2026 · live URL. One hillshade pair as the backdrop. |
| 2 | **The problem** | "Analog sites are chosen by reputation, not measurement." Three familiar site names, no data behind them. |
| 3 | **The method, in one diagram** | Three 12 km windows (Moon / Mars / Earth) → one 30 m grid → six statistics → one distance. This is the slide that wins or loses the deck; draw it properly. |
| 4 | **The dataset** | 570 locations · 12 planetary references · 558 Earth candidates · 469 complete · 8 public datasets. Screenshot of the map with markers coloured by index. |
| 5 | **One worked result** | Connecting ridge → Transantarctic Dry Valleys, index 79.1. Two hillshades side by side plus the per-feature breakdown. |
| 6 | **What it does not claim** | Missing data named, not imputed. Askja excluded and why. Sensitivity: stable to weights, *not* to scale. |
| 7 | **Links** | Live app · GitHub · the one-line disclaimer. |

---

## 5. Numbers you may quote

All from the current data build. Re-check them if the pipeline is re-run.

| | |
|---|---|
| Locations | 570 |
| Planetary references | 12 — 8 lunar (LOLA), 4 Martian (CTX) |
| Earth candidates | 558 — 20 named sites, 538 survey cells |
| Complete Earth windows | 469 |
| Public datasets integrated | 8 (plus 8 documented as considered and not used) |
| Analysis window | 12 km × 12 km on a common 30 m grid |
| Connecting ridge, top analog | Transantarctic Mts / Dry Valleys 78.5° S 163.5° E, **index 79.1**, 100% coverage |
| Jezero, top analog | US Southwest / Great Basin cell, index 91.1 |
| Askja | not ranked — caldera lake masked, window 91.9% valid |
| Sensitivity, weights | median Spearman ρ **0.998** |
| Sensitivity, drop any feature | ρ ≥ 0.986 |
| Sensitivity, 6 km window | ρ **0.91**, top-10 overlap 4/10 |

**Do not** round 79.1 up to 80, or say "80% similar". The index is not a
percentage and not a probability — saying so on camera is the one thing that
would undercut the whole submission.

---

## 6. Before you upload

- [ ] 30-second cut is **under** 30 seconds, captions burned in.
- [ ] Both links public, tested in a private browser window with no login.
- [ ] Live app awake (see [DEPLOYMENT.md](DEPLOYMENT.md)) before judging opens.
- [ ] No music you do not hold the rights to — Space Apps requires you own or
      license everything in the submission.
- [ ] No faces or voices of anyone under 18.
- [ ] Every on-screen number matches the table above.
