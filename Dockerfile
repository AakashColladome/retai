# ==========================================
# RetAI Smart Hospitality OS - Production Dockerfile
# Multi-stage build: React Vite Frontend + FastAPI Uvicorn Backend
# ==========================================

# --- Stage 1: Build React Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python Backend & Unified Runtime ---
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    FRONTEND_DIST_PATH=/app/frontend/dist

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from stage 1
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

WORKDIR /app/backend

EXPOSE 8000

# Start Uvicorn bound to 0.0.0.0 and dynamic PORT env var (Render/Railway/Heroku/Fly standard)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
