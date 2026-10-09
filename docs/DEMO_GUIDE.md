# Demo guide (2–3 minutes)

## Before the demo

```bash
cd frontend && npm run build && cd ..
cd backend && ../.venv/bin/uvicorn app.main:app --port 8000
# open http://127.0.0.1:8000/  (or run `npm run dev` and use :5173)
```

Check that `/api/health` reports 570 locations. All numbers below come from the current data build (2026-10-09).

## Script

1. **Home (15 s).** Read the one-line objective and point at the disclaimer: similar terrain statistics, not identical environments, not landing sites.
2. **Explorer → Moon → "Connecting ridge" (20 s).** Show the reference card: the hillshade of the 12 km LOLA window, the STAC-derived
   coordinates, the CC0 dataset link and the feature values (relief 1 099 m, median slope 10.4°).
3. **Weights (15 s).** Explain the six features and that every slider changes the request. Keep the defaults.
4. **Find Earth analogs (20 s).** #1 is the Transantarctic Mountains / Dry Valleys survey cell at 78.5° S 163.5° E (S = 79.1).
   The Atacama/Altiplano cells come next. Point at the colour legend and click markers on the map.
5. **Why this rank? (30 s).** In the detail panel, compare the two hillshades and the per-feature table. The contribution chart
   shows that the hypsometric integral accounts for about half of the remaining difference. The slope-distribution and
   relative-elevation charts overlap closely.
6. **Missing data (15 s).** Open "Not ranked (91) and why" and point at **Askja**. Its caldera lake is masked, so the window is 91.9 %
   valid and the site is excluded instead of being treated as a match.
7. **Switch to Mars → "Jezero crater region" (20 s).** The top cells are in the US Southwest (S = 91.1), Iceland and the Canadian Arctic.
   Kīlauea is the best named site, at #9.
8. **Compare (15 s).** "Add to compare" on two candidates, then open Compare: one table and the overlaid distributions.
9. **Data & methods (15 s).** Show the dataset catalogue with licences and DOI, the formula, and the sensitivity table: the ranking is
   robust to weights, but the window size matters.

Fallback: if the basemap does not load, the map shows a graticule and a notice, and everything else works.

## Other reproducible observations (default weights)

| Target | #1 overall | Best named site |
|---|---|---|
| Shackleton rim | Haleakalā summit depression (S 59.9) | same |
| Malapert massif | Haleakalā (S 59.0) | same |
| Leibnitz beta plateau | Transantarctic cell 78.5° S 163.5° E (S 75.4) | Mauna Kea, #2 (S 73.1) |
| de Gerlache rim | Mauna Kea (S 60.5) | same |
| Meridiani Planum | Sahara cell 23° N 7° E (S 87.2) | Meteor Crater, #11 |
| Southern Utopia | Sahara cell 19° N 15° E (S 88.8) | Lonar crater, #38 |

## Submission checklist

**Official requirements were not verified.** The challenge site could not be reached from the build environment. Before submitting:

- [ ] Read the official challenge page and confirm its objectives and any recommended datasets; record differences in the README §2.
- [ ] Confirm the official submission requirements (project page fields, demo video or slides, repository link, deadlines).
- [ ] Add team names to README §16 and the About page.
- [ ] Push the code to a public repository (`data/cache/` is git-ignored; `data/processed/` is small enough to commit).
- [ ] Optionally deploy, for example with `docker compose up --build`. Verify the Docker build first; it has not been run.
- [ ] Record the demo following this script.
- [ ] Spot-check named-site coordinates against a gazetteer.
