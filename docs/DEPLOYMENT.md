# Deployment

The whole app is one Docker container: a FastAPI process serving both the API and the built React frontend, with the
13 MB processed dataset and all 526 hillshade renders baked into the image. No database, no object store, no secrets.
Measured at **58 MB resident** with every dataset loaded and a full search run, so it fits the smallest free tier
anywhere.

**Target: a free Render web service.**

> **Hugging Face Spaces was the original plan and no longer works for this project.** Hugging Face's own hardware docs
> now state: *"CPU Basic has no hourly cost, but creating a new Space that runs on compute (Gradio or Docker) requires
> a paid plan. Static Spaces are free for everyone."* A Docker Space needs PRO at $9/month. Static Spaces are free but
> cannot run the Python API. Keep this in mind if you see older guides — including an earlier version of this file.

---

## What is already set up

- **`render.yaml`** — a Render Blueprint, so the service is created from the repo instead of by filling in a form.
- **`Dockerfile`** — multi-stage: Node builds the frontend, then a slim Python image installs the API dependencies and
  copies in `data/processed`, `data/sources` and the built `frontend/dist`. It binds `${PORT:-8000}`, which is exactly
  what Render needs (Render injects `PORT`), and runs as a non-root user.
- **`/api/health`** — used as the Render health check. It returns `{"status":"ok","locations":570,...}`.

Nothing writes to disk at runtime, so the lack of a persistent disk on the free plan is not a problem.

---

## Deploying

1. Sign up at <https://dashboard.render.com/register> — the free plan does not ask for a card at signup. Sign in with
   GitHub so Render can see the repository.

2. Go to <https://dashboard.render.com/blueprints> → **New Blueprint Instance** → pick
   `shishir-kuet/terrestrial-analog-finder` → **Apply**. Render reads `render.yaml` and creates the service.

   *If you would rather not use the Blueprint:* **New +** → **Web Service** → connect the repo → set **Language** to
   **Docker**, **Instance Type** to **Free**, **Health Check Path** to `/api/health`, and leave the rest at defaults.

3. Wait for the first build: roughly **5–10 minutes** (`npm ci`, the Vite build, then the Python dependencies). Watch
   the **Logs** tab. It is up when the log shows:

   ```
   INFO:     Uvicorn running on http://0.0.0.0:10000
   INFO:     Application startup complete.
   ```

Your public URL is `https://terrestrial-analog-finder.onrender.com` (Render appends a suffix if the name is taken —
the dashboard shows the real one). **That is the link to put in the submission.**

### Redeploying

`autoDeploy: true` is set, so every push to `main` rebuilds the service. Nothing else to do.

---

## Keeping it awake (do this before judging)

A free Render service **spins down after 15 minutes with no traffic** and takes about a minute to come back. A judge
clicking your link and getting a blank minute is the worst possible first impression.

Render's free allowance is **750 instance hours per workspace per month**. A 31-day month is 744 hours — so keeping a
single service running continuously fits inside the free allowance with hours to spare.

Set up a free pinger:

1. <https://cron-job.org> (free, no card) or <https://uptimerobot.com> (free tier, 5-minute interval).
2. Add a job hitting `https://<your-service>.onrender.com/api/health` every **10 minutes**.
3. Confirm it reports HTTP 200.

Turn the pinger on a few days before submission and leave it until judging ends. One service only — a second one would
push you past 750 hours.

---

## Verifying the deployment

Check these by hand once the build is green. They are the things that break in a new environment:

| Check | Expected |
|---|---|
| `https://<service>.onrender.com/api/health` | `{"status":"ok","locations":570,...}` |
| Landing page | Target spotlight rotates through real hillshade renders |
| Explorer → Moon → Connecting ridge → Find Earth analogs | #1 is the Transantarctic cell at 78.5° S 163.5° E, index 79.1 |
| Data & methods page | Dataset list populated with 8 datasets — proves the browser can reach the API |
| Open in a private window | Loads with no login prompt |

If the map tiles are blank, that is OpenStreetMap rate-limiting a shared host, not a deployment fault — the app falls
back to a graticule and says so. Everything else keeps working.

---

## Troubleshooting

**Build fails in the `npm ci` stage.** The lockfile and `package.json` must agree. Run `npm ci` locally first; if it
fails there it will fail on Render.

**Build succeeds, service shows "Port scan timeout".** The container is not binding the port Render injected. The
Dockerfile's `CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]` handles this — check it has
not been changed to a hard-coded port, and that the host is `0.0.0.0` and not `127.0.0.1`.

**Service restarts in a loop.** Check the logs for `DataUnavailable`. That means `data/processed/` did not make it into
the image — confirm those files are committed and not caught by `.dockerignore`.

**First request after idle takes a minute.** Expected on the free plan. Set up the pinger above.

**Build minutes or bandwidth exhausted.** The free allowance is per workspace per calendar month. Without a payment
method on file, Render suspends free services for the rest of the month when outbound bandwidth runs out. A hackathon
demo will not come close, but do not point a load test at it.

---

## Alternatives

The image is a plain Dockerfile with no host-specific code, so it runs anywhere that takes one:

| Host | Free? | Catch |
|---|---|---|
| **Render** | yes, 750 h/month | sleeps after 15 min idle — solved by the pinger above |
| **Hugging Face Spaces** | **no** for Docker | needs PRO at $9/month; Static Spaces are free but cannot run the API |
| **Fly.io** | small free allowance | card verification required even on free |
| **Railway** | no | one-time $5 trial credit, then paid |
| **Any VPS** | no | `git clone && docker compose up --build -d` is the whole deployment |

**You do not strictly need any of these.** Space Apps accepts a public code repository as the "link to final project".
A live URL is better because judges click it, but if hosting becomes a time sink before the deadline, ship the repo
link and spend the time on the demo instead.
