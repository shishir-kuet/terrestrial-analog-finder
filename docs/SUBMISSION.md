# Space Apps submission pack — Team ghostblood

Everything needed to fill in the Project tab on spaceappschallenge.org, plus the checklist of things that still
have to happen outside this repository. Draft text is written to be pasted straight into the project page.

**Event:** NASA Space Apps Challenge 2026 · **Team:** ghostblood
**Submission window:** Saturday 14 November 09:00 → Sunday 15 November 23:59, local time.

---

## 1. What Space Apps asks for

Verified against the official project submission guide (2025 edition; re-check the 2026 page before you submit):

| Item | Rule |
|---|---|
| **Project demo** | **Required.** Either a video of **up to 30 seconds** or a slide deck of **up to 7 slides including the title slide**. |
| **Where files live** | Images (JPG/PNG/GIF, ≤10 MB) upload directly to the project page. Videos and documents **cannot** — host them on YouTube, Drive, GitHub, OneDrive or Dropbox and paste a **public link that needs no login**. |
| **Resources list** | List every code, text and image resource used, including open-source and freely available ones. |
| **How to submit** | Through the **Project tab** on the team page. Submitting earns the participant certificate and makes the team eligible for Global Judging. |
| **Team size** | No more than six participants. |
| **Global Judging** | Answer an official challenge (not "Create Your Own"), every member registered and listed on the **Members** tab, all required fields completed **in English**, submitted by the local deadline. |
| **Content rules** | Only material the team holds the rights to. No personally identifiable information. No recognisable names, voices or likenesses of people under 18. |

The exact field labels on the 2026 project page could not be confirmed from this build environment. Recent years have
used roughly: *Project Name · High-Level Project Summary · Link to Project Demo · Link to Final Project · Detailed
Project Description · NASA Data · Space Agency Partner & Other Data · Use of Artificial Intelligence · Hackathon
Journey / References*. Section 3 below is written against that shape — adjust the headings to whatever the live form shows.

### Does the app have to be hosted?

**No — a public code repository satisfies "link to final project."** But the link must be publicly reachable with no
login, and judges watch a 30-second demo and then click through. A live URL they can click beats a repo they would have
to build. The whole app is one Docker container with the data baked in (13 MB, 58 MB resident), so hosting is free.
It deploys to a free Render web service; see [DEPLOYMENT.md](DEPLOYMENT.md), which also explains why Hugging Face
Spaces is no longer an option (Docker Spaces now need a paid plan).

---

## 2. Verified project facts

Every number below comes from the running API on data build `2026-10-09T18:19:51+00:00`. Re-run the data pipeline and
these may change — regenerate rather than edit by hand.

| Fact | Value |
|---|---|
| Locations in the build | **570** |
| Planetary reference sites | **12** — 8 lunar south-polar (LOLA), 4 Martian (CTX) |
| Earth candidate windows | **558** — 20 named analog sites, 538 survey-grid cells |
| Earth windows with complete terrain | **469** (89 excluded, each with a stated reason) |
| Survey regions | 12, across desert, polar and volcanic terrain |
| Source datasets integrated | **8** (plus 8 investigated and documented as not integrated) |
| Earth windows carrying a thermal measurement | **247** |
| Earth windows carrying mineral classes | **338** |
| Analysis window | 12 km × 12 km, resampled to a common **30 m** grid |
| Scored features | 5 scalar + 1 distribution (Wasserstein-1 on slope histograms) |

**Headline demo result:** for the lunar *Connecting ridge* reference with default weights, the top Earth analog is the
**Transantarctic Mountains / Dry Valleys survey cell at 78.5° S 163.5° E, similarity index 79.1**, at 100 % data coverage.

**Robustness (from the shipped sensitivity analysis):** ranking is near-invariant to weight perturbation
(median Spearman ρ = 0.998) and to dropping any single feature (ρ ≥ 0.986). It is sensitive to scale — halving the
window to 6 km drops ρ to 0.91 and top-10 overlap to 4/10. That is a real finding and is stated in the app, not hidden.

---

## 3. Draft project-page copy

### Project name

**Terrestrial Analog Finder**

### High-level project summary (short)

> Terrestrial Analog Finder ranks real places on Earth by how closely their *measured* terrain matches lunar
> south-polar sites under study for a sustained Moon presence, and well-studied regions of Mars — and shows, feature
> by feature, exactly why each place ranks where it does.
>
> Analog site selection today leans on expert judgement and reputation: the Atacama, Haughton Crater, Devon Island.
> We replaced the reputation step with measurement. Every 12 km × 12 km window on all three bodies is resampled to the
> same 30 m grid and described by the same six terrain statistics, so a lunar window and an Antarctic window are
> compared like with like. The score is a transparent weighted distance you can re-derive by hand: no model, no
> training data, no black box. Missing measurements are named and penalised, never filled in with a zero.
>
> The result is 570 measured locations, 12 planetary references and 558 Earth candidates, with a map, per-feature
> breakdowns, side-by-side hillshades and a live data-and-methodology page. The whole ranking is reproducible from
> public NASA, USGS and ESA archives.

### Detailed project description

> **What it does.** Pick the Moon or Mars, pick one of 12 planetary reference regions, set how much each terrain
> feature should matter, and the app ranks 558 Earth windows against it. Each result opens into the evidence behind
> its score: the two hillshades side by side, a per-feature table of measured values and scaled differences, a chart
> of which feature drives the remaining gap, overlaid slope and relative-elevation distributions, and the thermal and
> mineral measurements for both windows.
>
> **How it works.** An offline pipeline reads elevation windows directly from cloud-optimised public archives — LRO
> LOLA south-polar DTMs and MRO CTX DTMs from the USGS Astrogeology analysis-ready archive, and Copernicus DEM GLO-30
> for Earth. Each window is reprojected into a local azimuthal-equidistant grid centred on its own coordinates, using
> the correct figure for its body, and resampled to 30 m. Windows below the valid-cell threshold are rejected with a
> stated reason rather than scored on partial data.
>
> From each window we measure local relief, median slope, 90th-percentile slope, short-baseline roughness, the
> hypsometric integral, and the full slope histogram. Differences are divided by the inter-quartile range of that
> feature across a fixed Earth reference pool, so features in metres and features in degrees contribute comparably.
> The distance is D = sqrt( (Σ_available wᵢdᵢ² + Σ_missing wᵢP²) / Σ_all wᵢ ) and the reported index is S = 100·exp(−D).
> S = 100 means identical on the selected features; S ≈ 37 means they differ by one IQR on average.
>
> **Why the hard parts are hard.** Absolute elevation cannot be compared across bodies — the vertical datums are
> unrelated — so we report it for context and never score it. Slope and roughness depend on the grid they are measured
> on, which is why everything is forced onto one grid before anything is compared. A second layer measures thermal and
> mineral properties from ECOSTRESS, VIIRS, EMIT, MGS TES and LRO Diviner; of all of it, only the within-body
> thermal-inertia percentile is honestly comparable across bodies, so that is the only one allowed into scoring — and
> it ships with a default weight of zero, so the terrain ranking stays exactly reproducible. Everything else is shown
> per location and labelled context-only.
>
> **What we checked.** A shipped sensitivity analysis perturbs the weights and drops each feature in turn: the ranking
> is stable (median Spearman ρ ≥ 0.986 throughout, 0.998 under random weight perturbation). It is *not* stable to
> scale — a 6 km window gives ρ = 0.91 and only 4/10 top-10 overlap. We state that in the app rather than hiding it.
>
> **What it is not.** A high index means similar terrain statistics at the 12 km / 30 m scale. It is not a
> probability, it does not mean a place is physically like the Moon or Mars, and it does not identify landing sites,
> safe habitats or operationally suitable locations. Gravity, atmosphere, radiation, illumination and regolith depth
> are not represented. These limits are on the landing page, on every candidate panel and on a dedicated page.

### NASA data

- **LRO LOLA south-polar DTMs** (Barker et al.), analysis-ready COGs via the USGS Astrogeology STAC archive — CC0-1.0. Lunar reference terrain.
- **MRO CTX controlled DTMs**, USGS Astrogeology / Ames Stereo Pipeline — CC0-1.0. Martian reference terrain.
- **ECOSTRESS land-surface temperature** (ECO_L2T_LSTE v002), NASA JPL via LP DAAC. Earth day/night LST.
- **VIIRS/NPP BRDF white-sky shortwave albedo** (VNP43MA3 v002), NASA/NOAA via LP DAAC. Earth albedo.
- **EMIT estimated mineral identification and band depth** (EMITL2BMIN v002), NASA JPL via LP DAAC. Earth surface mineral classes.
- **MGS TES derived nightside thermal inertia map**, NASA PDS — public domain. Mars thermal inertia.
- **LRO Diviner Polar Resource Product, south** (LRO-L-DLRE-5-PRP-V2.0), NASA PDS — public domain. Lunar polar temperatures and ice-stability depth.

Eight further sources were investigated and deliberately **not** integrated; each is listed in the app with the reason
and what it would have provided.

### Space agency partner & other data

- **Copernicus DEM GLO-30 Public** — ESA / Copernicus Programme (DLR & Airbus Defence and Space, TanDEM-X), via the AWS Registry of Open Data. Earth elevation. Free use with attribution.
- **OpenStreetMap** contributors — basemap tiles only.

### Use of artificial intelligence

State this honestly and specifically. Draft:

> No machine-learning model is used anywhere in the ranking. The similarity score is a closed-form weighted distance
> over measured terrain statistics, and the same inputs always produce the same output.
>
> AI coding assistants were used during development to help write and review application code, tests and
> documentation. All scientific choices — feature definitions, normalisation, the missing-data policy, which
> measurements are allowed to be compared across bodies — were made and verified by the team, and every number shown
> in the app is computed from the public datasets listed above.

*(Adjust the second paragraph to match what the team actually did.)*

### Links

| Field | Value |
|---|---|
| Link to Project Demo | *(30-second video or ≤7-slide deck — see §4)* |
| Link to Final Project | `https://github.com/shishir-kuet/terrestrial-analog-finder` |
| Live app | *(see [DEPLOYMENT.md](DEPLOYMENT.md))* |

---

## 4. The demo (required)

Pick **one**: a video of **≤30 seconds**, or a deck of **≤7 slides** including the title slide.

A 30-second video is the stronger choice here — the product is interactive and the one thing a static deck cannot show
is a weight slider changing a ranking. Suggested 30-second cut:

| Time | Shot | Say |
|---|---|---|
| 0–4 s | Landing page, target spotlight rotating | "Which places on Earth actually look like the Moon?" |
| 4–10 s | Explorer, Moon → Connecting ridge, reference hillshade visible | "Pick a lunar site measured from LOLA." |
| 10–15 s | Weight sliders, then click Find Earth analogs | "Decide what matters. Nothing is weighted behind your back." |
| 15–22 s | Ranked list fills, map markers colour, click #1 | "The Transantarctic Dry Valleys score 79 out of 100." |
| 22–28 s | Detail panel: two hillshades, per-feature table, contribution chart | "And here is exactly why — feature by feature." |
| 28–30 s | Disclaimer line / title card with team name | "Terrestrial Analog Finder. Team ghostblood." |

If you make a deck instead, 7 slides: title · the problem · the method in one diagram · the 570-location dataset ·
one worked result · what it does *not* claim · links.

The 4-minute presentation script in [VIDEO.md](VIDEO.md) is supporting material, not this field — it is far over
the 30-second limit.

---

## 5. Checklist

Repository and app:

- [x] Docker build verified end to end (`docker compose up --build`, all endpoints 200).
- [x] Team name recorded in the app and README.
- [x] Dataset catalogue, licences and DOIs served live and visible in the app.
- [x] Sensitivity analysis shipped and shown.
- [ ] Push the current branch to the public GitHub repo and confirm it is public and clones cleanly.
- [ ] Deploy a live URL on Render (see [DEPLOYMENT.md](DEPLOYMENT.md)) and confirm it opens with no login.
- [ ] Set up the uptime pinger so the free service does not sleep during judging.
- [ ] Add individual member names to the About page and README §16.

Space Apps project page:

- [ ] Read the live 2026 submission guide and reconcile the field names in §3 against the real form.
- [ ] Confirm the challenge title and objectives on the official challenge page, and correct README §2 if they differ.
- [ ] Record the ≤30-second demo (or build the ≤7-slide deck) and host it on a public, no-login link.
- [ ] Paste §3 copy into the project page, in English, every required field filled.
- [ ] List all resources used, including open-source ones.
- [ ] Every team member registered and listed on the Members tab.
- [ ] Submit before the local deadline on Sunday 15 November, 23:59.

Science housekeeping:

- [ ] Spot-check the 20 named-site coordinates against a gazetteer — they are currently flagged in the app as approximate and unverified.
