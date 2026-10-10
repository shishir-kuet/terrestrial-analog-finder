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

## 3. The long walkthrough (2:30–3:00)

Linked as supporting material, not as the Project Demo. **≈430 words.**

### Opening — the problem (0:00–0:25)

> Analog site selection for Moon and Mars missions usually comes down to
> reputation. The Atacama. Haughton Crater. Devon Island. These are good
> choices, but they were argued for, not measured. If you want a site that
> matches a specific lunar ridge, on a specific property, at a specific scale,
> there is no tool that will tell you which one and show you the evidence.
>
> That is the gap we built for.

### What it does (0:25–1:00)

*Screen: landing page, then Explorer with Moon selected.*

> Terrestrial Analog Finder measures terrain. Twelve kilometre by twelve
> kilometre windows, on the Moon, on Mars and on Earth, all resampled to the
> same thirty metre grid, all described by the same six statistics: local
> relief, median slope, ninetieth-percentile slope, short-baseline roughness,
> the hypsometric integral, and the full slope distribution.
>
> Because every window is measured the same way, a lunar window and an
> Antarctic window can be compared like with like. Five hundred and seventy
> locations: twelve planetary references, five hundred and fifty-eight Earth
> candidates.

### The demo (1:00–2:00)

*Screen: run the Connecting ridge search, open result #1, open the excluded list.*

> Pick Connecting ridge, near the lunar south pole, measured from LOLA. Set
> the weights yourself — you decide whether roughness matters more than slope.
> Search.
>
> The top Earth analog is a survey cell in the Transantarctic Mountains, Dry
> Valleys, at seventy-eight and a half degrees south. Similarity index
> seventy-nine. Open it, and the score comes apart: the two hillshades side by
> side, every feature's measured value, how far apart they are in robust
> units, and which feature drives the remaining gap.
>
> Nothing is hidden. Look at Askja, in Iceland — it is not ranked at all,
> because its caldera lake is masked out and the window is only ninety-two
> percent valid. We exclude it and say why, rather than scoring it on partial
> data.

### Why you should believe it (2:00–2:40)

*Screen: Data and methodology page — sensitivity table and limitations.*

> There is no model here. The score is a weighted distance you can re-derive
> by hand, from eight public NASA, USGS and ESA datasets, every one cited with
> its licence and DOI in the app.
>
> We also tested whether the ranking holds up. Perturb the weights, and the
> order barely moves — Spearman rho nought point nine nine eight. Drop any
> single feature, still above nought point nine eight. But halve the window to
> six kilometres and rho falls to nought point nine one. The result is scale
> dependent, and we say so in the app instead of hiding it.

### Close (2:40–3:00)

> A high score means similar terrain statistics at this scale. It is not a
> landing site, not a habitability judgement, not a probability. It is a
> measured, reproducible starting point for the people who choose where to
> test the hardware that goes to the Moon.
>
> Terrestrial Analog Finder. Team ghostblood.

---

## 4. The 7-slide deck (alternative to the video)

Use this only if you submit slides instead of a video. One idea per slide; the
notes are what you would say, not what you print.

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
