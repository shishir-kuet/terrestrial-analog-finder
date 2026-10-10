# Deployment — Hugging Face Spaces

The whole app is one Docker container: a FastAPI process that serves both the API and the built React frontend, with
the 13 MB processed dataset and all 526 hillshade renders baked into the image. No database, no object store, no
secrets. That makes it cheap to host and quick to reproduce.

Target: a **free Hugging Face Space**, Docker SDK. Free forever, no credit card, a permanent public URL, and no
cold-start sleep — a judge who clicks the link gets the running app.

---

## What is already set up

- **`README.md` front matter** — the YAML block at the top of the repo README is the Space configuration. Hugging
  Face reads `sdk: docker` and `app_port: 8000` from it. GitHub renders it as a small metadata table; that is the only
  cost of keeping one repo for both remotes.
- **`Dockerfile`** — multi-stage: Node builds the frontend, then a slim Python image installs the API dependencies and
  copies in `data/processed`, `data/sources` and the built `frontend/dist`. It runs as uid 1000 (what Spaces expects)
  and honours a `PORT` environment variable, defaulting to 8000.
- **No Git LFS needed** — the largest file in the repo is 1.3 MB and the packed repo is about 9 MB, well under
  Hugging Face's 10 MB per-file threshold.

Nothing in the image needs to write to disk at runtime, so the read-only-ish Spaces filesystem is not a problem.

---

## One-time setup

1. Create an account at <https://huggingface.co/join> (free).

2. Create the Space: <https://huggingface.co/new-space>
   - **Owner:** your username (or a `ghostblood` organisation if you create one).
   - **Space name:** `terrestrial-analog-finder`
   - **License:** your choice.
   - **SDK:** **Docker** → **Blank**.
   - **Hardware:** CPU basic (free).
   - **Visibility:** **Public** — Space Apps requires a link that works with no login.

3. Create an access token with **write** permission: <https://huggingface.co/settings/tokens>
   (type "Write"). You will paste it as the password when git asks.

---

## Deploying

From the repository root. Replace `<USER>` with your Hugging Face username.

```bash
git remote add space https://huggingface.co/spaces/<USER>/terrestrial-analog-finder
git push space main --force
```

`--force` is needed on the **first** push only: creating a Space makes an initial commit with its own README, so our
history does not fast-forward onto it. There is nothing in that commit worth keeping. Later pushes are plain
`git push space main`.

Git will prompt for credentials: **username** = your Hugging Face username, **password** = the write token from step 3
(not your account password). On Windows the Git Credential Manager window asks for the same two values and remembers
them afterwards.

The Space then builds the Dockerfile. The first build takes roughly 5–10 minutes — `npm ci` plus the Vite build plus
the Python dependencies. Watch it under the **Logs** tab on the Space page; the build is finished when the logs show:

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

Your public URL is then `https://huggingface.co/spaces/<USER>/terrestrial-analog-finder`, and the app itself is also
served directly at `https://<USER>-terrestrial-analog-finder.hf.space`. **Use the second one as the demo link** — it
is the bare app without the Hugging Face page frame around it.

### Redeploying after a change

```bash
git push space main
```

That is the whole loop. Spaces rebuilds on every push.

---

## Verifying the deployment

Once the build is green, check these by hand — they are the things that break in a new environment:

| Check | Expected |
|---|---|
| `https://<USER>-terrestrial-analog-finder.hf.space/api/health` | `{"status":"ok","locations":570,...}` |
| Landing page | Target spotlight rotates through real hillshade renders |
| Explorer → Moon → Connecting ridge → Find Earth analogs | #1 is the Transantarctic cell at 78.5° S 163.5° E, index 79.1 |
| Open in a private window | Loads with no login prompt |
| Data & methods page | Dataset list populated (8 datasets) — proves the API is reachable from the browser |

If the map tiles are blank, that is OpenStreetMap rate-limiting from a shared host, not a deployment fault — the app
falls back to a graticule and says so. Everything else keeps working.

---

## Troubleshooting

**Build fails in the `npm ci` stage.** The lockfile and `package.json` must agree. Run `npm ci` locally first; if it
fails there it will fail on the Space.

**Space shows "Configuration error".** The YAML front matter in `README.md` is malformed or missing. It must be the
very first thing in the file, `---` on line 1, and `sdk: docker` must be present.

**App builds but the Space shows a blank page or a timeout.** The container is not listening on the declared port.
Confirm `app_port: 8000` in the front matter matches the port uvicorn binds — the Dockerfile's `${PORT:-8000}` resolves
to 8000 when Spaces does not inject one.

**`git push space main` rejected.** Either the token lacks write permission (make a new one of type *Write*), or you
omitted `--force` on the first push — see above.

**Push is slow.** The repo carries 526 hillshade PNGs and the processed dataset, about 9 MB packed. That is a one-time
cost; later pushes send only the diff.

---

## Alternatives, if you ever need them

The image is a plain Dockerfile with no host-specific code, so it runs anywhere that takes one:

- **Render** — free Docker web service, but it sleeps after 15 minutes idle, so a judge's click hits a ~50 s cold start.
- **Fly.io** — fast and always-on, but needs card verification even on the free allowance.
- **Any VPS** — `git clone && docker compose up --build -d` is the whole deployment.

Hugging Face was chosen over these because it is free, needs no card, and does not sleep.
