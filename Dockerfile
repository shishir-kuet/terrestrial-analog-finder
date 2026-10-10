# Single container: built frontend served by the FastAPI backend on port 8000.
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app backend/app
COPY data/processed data/processed
COPY data/sources data/sources
COPY --from=web /web/dist frontend/dist
ENV TAF_DATA_DIR=/app/data
# Hugging Face Spaces runs Docker containers as uid 1000; everything this image
# serves is read-only, so dropping to that user costs nothing and avoids any
# permission surprise on hosts that expect it.
RUN useradd -m -u 1000 app && chown -R app:app /app
USER app

WORKDIR /app/backend
EXPOSE 8000
# PORT is honoured so the same image runs behind hosts that inject one.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
