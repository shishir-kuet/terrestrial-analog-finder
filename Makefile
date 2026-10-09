# Convenience targets. Run from the repository root.
PY ?= python3
VENV = .venv
BIN = $(VENV)/bin

.PHONY: setup data env-data sensitivity api web test lint build docker

setup:            ## create venv and install backend + frontend dependencies
	$(PY) -m venv $(VENV)
	$(BIN)/pip install -r backend/requirements-dev.txt
	cd frontend && npm ci

data:             ## (re)build data/processed from the public sources (uses data/cache)
	cd backend && ../$(BIN)/python -m pipeline.build

env-data:         ## (re)build the thermal and mineral layer (needs a NASA Earthdata token; resumable)
	cd backend && ../$(BIN)/python -m pipeline.build_env

sensitivity:      ## recompute the sensitivity analysis (needs data/cache from `make data`)
	cd backend && ../$(BIN)/python -m pipeline.sensitivity

api:              ## run the API on http://127.0.0.1:8000
	cd backend && ../$(BIN)/uvicorn app.main:app --reload --port 8000

web:              ## run the frontend dev server on http://127.0.0.1:5173
	cd frontend && npm run dev

test:             ## backend + frontend tests
	cd backend && ../$(BIN)/python -m pytest -q
	cd frontend && npm test

lint:             ## type checks and lint
	cd frontend && npm run typecheck && npm run lint

build:            ## production frontend build (served by the API when present)
	cd frontend && npm run build

docker:
	docker compose up --build
